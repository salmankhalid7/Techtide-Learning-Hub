/**
 * @file dashboard.instructor.analytics.js
 * @description Instructor dashboard analytics + composite endpoints.
 *
 * Instructor-scoped methods for monthly enrollments, engagement, earnings,
 * the instructor action center and the legacy composite `getDashboardStats`.
 * Exported as a plain object that the facade mixes onto its prototype, so
 * `this._resolveScope`, `this._getCourseScope`, `this._aggregateEnrollmentStatus`,
 * `this._aggregateCompletionRate` resolve at runtime.
 */

import mongoose from "mongoose";

import {
  Course,
  Module,
  Lesson,
  Quiz,
  QUIZ_STATUS,
  Enrollment,
  MODULE_STATUS,
  LESSON_STATUS_ENUM,
  COURSE_STATUS,
  DEFAULT_PAGE,
  DEFAULT_RECENT_COURSES_LIMIT,
  DEFAULT_RECENT_ENROLLMENTS_LIMIT,
  DEFAULT_TOP_COURSES_LIMIT,
} from "./dashboard.constants.js";

const instructorAnalytics = {
  /* ------------------------------------------------------------------------ */
  /*                         Monthly Enrollments                              */
  /* ------------------------------------------------------------------------ */

  /**
   * Monthly enrollment counts for the instructor's courses, optionally for a year.
   * @param {string} instructorId
   * @param {{ year?: number }} [filters]
   */
  async getMonthlyEnrollments(instructorId, filters = {}, _scope) {
    const { year } = filters;
    const courseIds = (await this._resolveScope(instructorId, _scope)).courseIds;

    const match = { course: { $in: courseIds } };

    // Filter to a specific calendar year when provided (index-friendly range).
    if (year) {
      match.enrolledAt = {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${Number(year) + 1}-01-01`),
      };
    }

    const monthlyEnrollments = await Enrollment.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$enrolledAt" },
            month: { $month: "$enrolledAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          count: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);

    return {
      ...(year ? { year: Number(year) } : {}),
      monthlyEnrollments,
    };
  },

  /* ------------------------------------------------------------------------ */
  /*                         Engagement Analytics                             */
  /* ------------------------------------------------------------------------ */

  /**
   * High-level student engagement statistics.
   * @param {string} instructorId
   */
  async getEngagementStats(instructorId, _scope) {
    const courseIds = (await this._resolveScope(instructorId, _scope)).courseIds;

    const [studentStats, averageCompletionRate] = await Promise.all([
      this._aggregateEnrollmentStatus(courseIds),
      this._aggregateCompletionRate(courseIds),
    ]);

    return {
      activeStudents: studentStats.activeStudents,
      completedStudents: studentStats.completedStudents,
      droppedStudents: studentStats.droppedStudents,
      suspendedStudents: studentStats.suspendedStudents,
      averageCompletionRate,
    };
  },

  /* ------------------------------------------------------------------------ */
  /*                           Earnings Analytics                             */
  /* ------------------------------------------------------------------------ */

  /**
   * Earnings dashboard foundation.
   * Payments are not implemented yet, so the structure is returned with
   * zeroed values that can be populated once the Payment module exists.
   * @param {string} instructorId
   */
  // eslint-disable-next-line no-unused-vars
  async getEarningsStats(instructorId) {
    return {
      overview: {
        totalRevenue: 0,
        totalSales: 0,
        averageOrderValue: 0,
        refundedAmount: 0,
        currency: "USD",
      },

      monthlyRevenue: [],

      recentTransactions: [],

      topSellingCourses: [],
    };
  },

  /* ------------------------------------------------------------------------ */
  /*                            Action Center                                 */
  /* ------------------------------------------------------------------------ */

  /**
   * Items that require the instructor's attention.
   *
   * Each bucket is returned as `{ count, items }` so the frontend can render
   * previews immediately without additional API calls. `items` are limited to
   * a small preview window.
   * @param {string} instructorId
   * @param {{ previewLimit?: number }} [options]
   */
  async getActionCenter(instructorId, options = {}, _scope) {
    const { previewLimit = 5 } = options;
    const { courseIds, moduleIds } = await this._resolveScope(instructorId, _scope);
    const instructorObjectId = new mongoose.Types.ObjectId(instructorId);

    const [
      draftCourseDocs,
      unpublishedModules,
      unpublishedLessons,
      unpublishedQuizDocs,
      coursesWithoutModules,
      modulesWithoutLessons,
      coursesReadyToPublish,
    ] = await Promise.all([
      // Draft courses (with preview items).
      Promise.all([
        Course.find({
          instructor: instructorObjectId,
          isDeleted: false,
          status: COURSE_STATUS.DRAFT,
        })
          .select("title slug thumbnail status updatedAt")
          .sort({ updatedAt: -1 })
          .limit(Number(previewLimit))
          .lean(),

        Course.countDocuments({
          instructor: instructorObjectId,
          isDeleted: false,
          status: COURSE_STATUS.DRAFT,
        }),
      ]),

      Module.countDocuments({
        course: { $in: courseIds },
        deletedAt: null,
        status: MODULE_STATUS.DRAFT,
      }),

      Lesson.countDocuments({
        module: { $in: moduleIds },
        isDeleted: false,
        status: LESSON_STATUS_ENUM.DRAFT,
      }),

      // Draft quizzes (with preview items).
      Promise.all([
        Quiz.find({
          course: { $in: courseIds },
          deletedAt: null,
          status: QUIZ_STATUS.DRAFT,
        })
          .select("title course status updatedAt")
          .sort({ updatedAt: -1 })
          .limit(Number(previewLimit))
          .lean(),

        Quiz.countDocuments({
          course: { $in: courseIds },
          deletedAt: null,
          status: QUIZ_STATUS.DRAFT,
        }),
      ]),

      Course.aggregate([
        {
          $match: {
            instructor: instructorObjectId,
            isDeleted: false,
          },
        },
        {
          $lookup: {
            from: "modules",
            localField: "_id",
            foreignField: "course",
            as: "modules",
          },
        },
        { $addFields: { moduleCount: { $size: "$modules" } } },
        { $match: { moduleCount: 0 } },
        { $count: "count" },
      ]),

      Module.aggregate([
        { $match: { course: { $in: courseIds }, deletedAt: null } },
        {
          $lookup: {
            from: "lessons",
            localField: "_id",
            foreignField: "module",
            as: "lessons",
          },
        },
        { $addFields: { lessonCount: { $size: "$lessons" } } },
        { $match: { lessonCount: 0 } },
        { $count: "count" },
      ]),

      Course.aggregate([
        {
          $match: {
            instructor: instructorObjectId,
            isDeleted: false,
            status: COURSE_STATUS.DRAFT,
          },
        },
        {
          $lookup: {
            from: "modules",
            localField: "_id",
            foreignField: "course",
            as: "modules",
          },
        },
        { $addFields: { moduleCount: { $size: "$modules" } } },
        {
          $lookup: {
            from: "lessons",
            localField: "modules._id",
            foreignField: "module",
            as: "lessons",
          },
        },
        {
          $lookup: {
            from: "quizzes",
            localField: "_id",
            foreignField: "course",
            as: "quizzes",
          },
        },
        {
          $addFields: {
            publishedLessons: {
              $size: {
                $filter: {
                  input: "$lessons",
                  as: "lesson",
                  cond: {
                    $eq: ["$$lesson.status", LESSON_STATUS_ENUM.PUBLISHED],
                  },
                },
              },
            },
            publishedQuizzes: {
              $size: {
                $filter: {
                  input: "$quizzes",
                  as: "quiz",
                  cond: { $eq: ["$$quiz.status", QUIZ_STATUS.PUBLISHED] },
                },
              },
            },
          },
        },
        {
          $match: {
            moduleCount: { $gt: 0 },
            publishedLessons: { $gt: 0 },
            publishedQuizzes: { $gt: 0 },
          },
        },
        { $count: "count" },
      ]),
    ]);

    return {
      draftCourses: {
        count: draftCourseDocs[1],
        items: draftCourseDocs[0],
      },
      unpublishedModules: {
        count: unpublishedModules,
        items: [],
      },
      unpublishedLessons: {
        count: unpublishedLessons,
        items: [],
      },
      unpublishedQuizzes: {
        count: unpublishedQuizDocs[1],
        items: unpublishedQuizDocs[0],
      },
      coursesWithoutModules: coursesWithoutModules[0]?.count ?? 0,
      modulesWithoutLessons: modulesWithoutLessons[0]?.count ?? 0,
      coursesReadyToPublish: coursesReadyToPublish[0]?.count ?? 0,
    };
  },

  /* ------------------------------------------------------------------------ */
  /*                         Composite (Legacy) Overview                      */
  /* ------------------------------------------------------------------------ */

  /**
   * Full dashboard payload. Composes all isolated analytics into one response
   * for clients that still consume a single aggregated endpoint.
   * @param {string} instructorId
   */
  async getDashboardStats(instructorId) {
    // Resolve the instructor's courses/modules once so every contained query
    // shares a single scope lookup instead of re-running identical aggregations.
    const scope = await this._getCourseScope(instructorId);

    const [
      overview,
      recentCourses,
      recentEnrollments,
      monthly,
      topCourses,
      engagement,
      earnings,
      actionCenter,
    ] = await Promise.all([
      this.getDashboardOverview(instructorId, scope),
      this.getRecentCourses(instructorId, {
        page: DEFAULT_PAGE,
        limit: DEFAULT_RECENT_COURSES_LIMIT,
      }),
      this.getRecentEnrollments(instructorId, {
        page: DEFAULT_PAGE,
        limit: DEFAULT_RECENT_ENROLLMENTS_LIMIT,
      }, scope),
      this.getMonthlyEnrollments(instructorId, {}, scope),
      this.getTopCourses(instructorId, DEFAULT_TOP_COURSES_LIMIT),
      this.getEngagementStats(instructorId, scope),
      this.getEarningsStats(instructorId),
      this.getActionCenter(instructorId, {}, scope),
    ]);

    return {
      overview,
      recentCourses: recentCourses.courses,
      recentEnrollments: recentEnrollments.enrollments,
      monthlyEnrollments: monthly.monthlyEnrollments,
      topCourses,
      engagement,
      earnings,
      actionCenter,
    };
  },
};

export default instructorAnalytics;
