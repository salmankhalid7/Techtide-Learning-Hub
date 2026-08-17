/**
 * @file dashboard.admin.health.js
 * @description Admin platform health, revenue and recent-activity endpoints.
 *
 * Admin-scoped methods for platform health (issue detection), revenue (a
 * placeholder until payments exist) and the recent-activity timeline. Exported
 * as a plain object that the facade mixes onto its prototype, so
 * `this._getCoursesWithoutModules`, `this._buildFlaggedItems`, etc. resolve at
 * runtime.
 */

import mongoose from "mongoose";

import {
  User,
  Course,
  Enrollment,
  Progress,
  Attempt,
  Order,
  Payment,
  ATTEMPT_STATUS,
  RECENT_ACTIVITY_PER_SOURCE,
  RECENT_ACTIVITY_TOTAL,
} from "./dashboard.constants.js";
import { PAYMENT_STATUS } from "../../constants/payment.constants.js";

const adminHealth = {
  /* ------------------------------------------------------------------------ */
  /*                            Platform Health                               */
  /* ------------------------------------------------------------------------ */

  /**
   * Platform health for admins.
   *
   * Surfaces issues that require attention using aggregation pipelines (not
   * N+1 loops). Flagged items are derived from the issue buckets.
   *
   * @returns {Promise<{
   *   overview: { totalIssues: number, publishReadyCourses: number },
   *   issues: {
   *     coursesWithoutModules: [],
   *     modulesWithoutLessons: [],
   *     lessonsWithoutContent: [],
   *     draftCoursesReadyForPublishing: [],
   *     flaggedItems: []
   *   }
   * }>}
   */
  async getPlatformHealth() {
    const [
      coursesWithoutModules,
      modulesWithoutLessons,
      lessonsWithoutContent,
      draftCoursesReadyForPublishing,
    ] = await Promise.all([
      this._getCoursesWithoutModules(),
      this._getModulesWithoutLessons(),
      this._getLessonsWithoutContent(),
      this._getDraftCoursesReadyForPublishing(),
    ]);

    const issues = {
      coursesWithoutModules,
      modulesWithoutLessons,
      lessonsWithoutContent,
      draftCoursesReadyForPublishing,
    };

    const overview = {
      totalIssues:
        coursesWithoutModules.length +
        modulesWithoutLessons.length +
        lessonsWithoutContent.length,
      publishReadyCourses: draftCoursesReadyForPublishing.length,
    };

    return {
      overview,

      issues: {
        ...issues,
        flaggedItems: this._buildFlaggedItems(issues),
      },
    };
  },

  /* ------------------------------------------------------------------------ */
  /*                            Revenue Analytics                             */
  /* ------------------------------------------------------------------------ */

  /**
   * Revenue analytics for admins.
   *
   * Computes platform-wide revenue from succeeded `Payment` records (net of
   * refunds). All monetary totals are returned un-rounded as stored integers /
   * floats so the frontend controls display formatting.
   *
   * @param {Object} query - { year?, limit?, page?, limit? }
   * @returns {Promise<{
   *   overview: { totalRevenue, monthlyRevenue, yearlyRevenue, averageOrderValue, currency },
   *   monthlyRevenue: [],
   *   topSellingCourses: [],
   *   transactions: [],
   *   paymentMethods: [],
   *   refunds: { totalRefunds, refundedAmount }
   * }>}
   */
  async getRevenueAnalytics(query = {}) {
    const year = Number(query.year) || new Date().getFullYear();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

    const startYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endYear = new Date(`${year + 1}-01-01T00:00:00.000Z`);

    const succeeded = { status: PAYMENT_STATUS.SUCCEEDED };

    // Aggregate refunds across all succeeded payments.
    const refundAgg = await Payment.aggregate([
      { $match: { status: PAYMENT_STATUS.SUCCEEDED } },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: { $size: { $ifNull: ["$refunds", []] } } },
          refundedAmount: { $sum: { $ifNull: ["$refundedAmount", 0] } },
        },
      },
    ]);
    const refunds = refundAgg[0] || { totalRefunds: 0, refundedAmount: 0 };

    // Totals: gross succeeded amount, net = gross - refunded.
    const totalAgg = await Payment.aggregate([
      { $match: succeeded },
      {
        $group: {
          _id: null,
          gross: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);
    const total = totalAgg[0] || { gross: 0, count: 0 };
    const totalRevenue = Math.max(0, total.gross - refunds.refundedAmount);

    // Monthly revenue for the requested year (net).
    const monthlyRevenue = await Payment.aggregate([
      {
        $match: {
          status: PAYMENT_STATUS.SUCCEEDED,
          paidAt: { $gte: startYear, $lt: endYear },
        },
      },
      {
        $group: {
          _id: { month: { $month: "$paidAt" } },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          month: "$_id.month",
          revenue: 1,
          count: 1,
        },
      },
      { $sort: { month: 1 } },
    ]);

    // Yearly revenue (net) for the requested year.
    const yearlyAgg = await Payment.aggregate([
      {
        $match: {
          status: PAYMENT_STATUS.SUCCEEDED,
          paidAt: { $gte: startYear, $lt: endYear },
        },
      },
      { $group: { _id: null, revenue: { $sum: "$amount" } } },
    ]);
    const yearlyRevenue = yearlyAgg[0]?.revenue || 0;

    const averageOrderValue = total.count > 0 ? total.gross / total.count : 0;

    // Top-selling courses via Order items (only paid orders).
    const topSellingCourses = await Order.aggregate([
      { $match: { status: "PAID" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.course",
          sales: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.unitPrice" },
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "courses",
          localField: "_id",
          foreignField: "_id",
          as: "course",
        },
      },
      {
        $project: {
          _id: 0,
          courseId: "$_id",
          title: { $arrayElemAt: ["$course.title", 0] },
          slug: { $arrayElemAt: ["$course.slug", 0] },
          sales: 1,
          revenue: 1,
        },
      },
    ]);

    // Recent transactions (payments with order/course context).
    const transactions = await Payment.aggregate([
      { $match: succeeded },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          amount: 1,
          currency: 1,
          provider: 1,
          status: 1,
          createdAt: 1,
          refundedAmount: 1,
        },
      },
    ]);

    // Payment method/provider distribution.
    const paymentMethods = await Payment.aggregate([
      { $match: succeeded },
      { $group: { _id: "$provider", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
      { $project: { _id: 0, provider: "$_id", count: 1, amount: 1 } },
      { $sort: { count: -1 } },
    ]);

    const currencies = await Payment.distinct("currency", succeeded);
    const currency = currencies.length === 1 ? currencies[0] : currencies.join("/");

    return {
      overview: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        monthlyRevenue: Math.round((monthlyRevenue.reduce((s, m) => s + m.revenue, 0)) * 100) / 100,
        yearlyRevenue: Math.round(yearlyRevenue * 100) / 100,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        currency,
      },
      monthlyRevenue,
      topSellingCourses,
      transactions,
      paymentMethods,
      refunds: {
        totalRefunds: refunds.totalRefunds,
        refundedAmount: Math.round(refunds.refundedAmount * 100) / 100,
      },
    };
  },

  /* ------------------------------------------------------------------------ */
  /*                             Recent Activity                              */
  /* ------------------------------------------------------------------------ */

  /**
   * Recent platform activity.
   *
   * Merges multiple collections into one timeline sorted newest-first. Each
   * source is mapped to a common activity shape, so future activity types
   * (enrollment, quiz attempt, completion, etc.) extend the timeline without
   * changing the response structure.
   *
   * @param {Object} query
   * @returns {Promise<Array<{ type: string, entityId, title: string, description: string, createdAt: Date }>>}
   */
  // eslint-disable-next-line no-unused-vars
  async getRecentActivity(query) {
    const [
      recentUsers,
      recentCourses,
      recentEnrollments,
      recentAttempts,
      recentCompletions,
    ] = await Promise.all([
      User.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(RECENT_ACTIVITY_PER_SOURCE)
        .select("fullName email role createdAt")
        .lean(),

      Course.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(RECENT_ACTIVITY_PER_SOURCE)
        .select("title createdAt")
        .lean(),

      Enrollment.find()
        .sort({ createdAt: -1 })
        .limit(RECENT_ACTIVITY_PER_SOURCE)
        .populate("student", "fullName")
        .populate("course", "title")
        .lean(),

      // Submitted/graded attempts are treated as completed quiz attempts.
      Attempt.find({ status: { $in: [ATTEMPT_STATUS.SUBMITTED, ATTEMPT_STATUS.GRADED] } })
        .sort({ createdAt: -1 })
        .limit(RECENT_ACTIVITY_PER_SOURCE)
        .populate("student", "fullName")
        .populate("quiz", "title")
        .lean(),

      Progress.find({ isCourseCompleted: true })
        .sort({ completedAt: -1 })
        .limit(RECENT_ACTIVITY_PER_SOURCE)
        .populate("student", "fullName")
        .populate("course", "title")
        .lean(),
    ]);

    const userActivities = recentUsers.map((user) => ({
      type: "USER_REGISTERED",
      entityId: user._id,
      title: `${user.fullName} registered`,
      description: `${user.role} account created`,
      createdAt: user.createdAt,
    }));

    const courseActivities = recentCourses.map((course) => ({
      type: "COURSE_CREATED",
      entityId: course._id,
      title: course.title,
      description: "New course created",
      createdAt: course.createdAt,
    }));

    const enrollmentActivities = recentEnrollments.map((enrollment) => ({
      type: "ENROLLMENT_CREATED",
      entityId: enrollment._id,
      title: enrollment.course?.title ?? "Course",
      description: `${enrollment.student?.fullName ?? "User"} enrolled`,
      createdAt: enrollment.createdAt,
    }));

    const attemptActivities = recentAttempts.map((attempt) => ({
      type: "QUIZ_ATTEMPT_COMPLETED",
      entityId: attempt._id,
      title: attempt.quiz?.title ?? "Quiz",
      description: `${attempt.student?.fullName ?? "Student"} completed a quiz`,
      createdAt: attempt.createdAt,
    }));

    const completionActivities = recentCompletions.map((progress) => ({
      type: "COURSE_COMPLETED",
      entityId: progress._id,
      title: progress.course?.title ?? "Course",
      description: `${progress.student?.fullName ?? "Student"} completed a course`,
      createdAt: progress.completedAt,
    }));

    const activities = [
      ...userActivities,
      ...courseActivities,
      ...enrollmentActivities,
      ...attemptActivities,
      ...completionActivities,
    ];

    // Newest first, then return only the latest items.
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return activities.slice(0, RECENT_ACTIVITY_TOTAL);
  },
};

export default adminHealth;
