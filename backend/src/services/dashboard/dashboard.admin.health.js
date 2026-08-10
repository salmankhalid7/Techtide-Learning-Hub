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

import {
  User,
  Course,
  Enrollment,
  Progress,
  Attempt,
  ATTEMPT_STATUS,
  RECENT_ACTIVITY_PER_SOURCE,
  RECENT_ACTIVITY_TOTAL,
} from "./dashboard.constants.js";

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
   * Placeholder: the Payments module is not implemented yet, so the response
   * shape is fixed up-front with zeroed values. This lets the frontend
   * integrate now and later plugs into Stripe/Razorpay/PayPal without changing
   * the API contract.
   *
   * @param {Object} query
   * @returns {Promise<{
   *   overview: { totalRevenue, monthlyRevenue, yearlyRevenue, averageOrderValue },
   *   monthlyRevenue: [],
   *   topSellingCourses: [],
   *   transactions: [],
   *   paymentMethods: [],
   *   refunds: { totalRefunds, refundedAmount }
   * }>}
   */
  // eslint-disable-next-line no-unused-vars
  async getRevenueAnalytics(query) {
    return {
      overview: {
        totalRevenue: 0,
        monthlyRevenue: 0,
        yearlyRevenue: 0,
        averageOrderValue: 0,
      },

      monthlyRevenue: [],

      topSellingCourses: [],

      transactions: [],

      paymentMethods: [],

      refunds: {
        totalRefunds: 0,
        refundedAmount: 0,
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
