import mongoose from "mongoose";

import Course from "../models/course.model.js";
import Module from "../models/module.model.js";
import Lesson from "../models/lesson.model.js";
import Quiz from "../models/quiz.model.js";
import Enrollment from "../models/enrollment.model.js";
import Progress from "../models/progress.model.js";

import { COURSE_STATUS } from "../constants/course.constants.js";
import { ENROLLMENT_STATUS } from "../constants/enrollment.constants.js";
import { MODULE_STATUS } from "../constants/module.constants.js";
import { LESSON_STATUS_ENUM } from "../constants/lesson.constants.js";

/**
 * A structure aggregating the instructor's authored courses and their IDs.
 * @typedef {Object} InstructorScope
 * @property {import("mongoose").Types.ObjectId} instructorObjectId
 * @property {import("mongoose").Types.ObjectId[]} courseIds
 * @property {import("mongoose").Types.ObjectId[]} moduleIds
 */

class DashboardService {
  /* ------------------------------------------------------------------------ */
  /*                              Private Helpers                             */
  /* ------------------------------------------------------------------------ */

  /**
   * Resolve the instructor's course IDs (non-deleted courses only).
   * @param {string|import("mongoose").Types.ObjectId} instructorId
   * @returns {Promise<import("mongoose").Types.ObjectId[]>}
   */
  async _getCourseIds(instructorId) {
    const instructorObjectId = new mongoose.Types.ObjectId(instructorId);

    const [courseStats] = await Course.aggregate([
      { $match: { instructor: instructorObjectId, isDeleted: false } },
      { $group: { _id: null, courseIds: { $push: "$_id" } } },
      { $project: { _id: 0, courseIds: 1 } },
    ]);

    return courseStats?.courseIds ?? [];
  }

  /**
   * Resolve the instructor's course IDs and module IDs (non-deleted only).
   * @param {string|import("mongoose").Types.ObjectId} instructorId
   * @returns {Promise<InstructorScope>}
   */
  async _getCourseScope(instructorId) {
    const instructorObjectId = new mongoose.Types.ObjectId(instructorId);

    const [courseStats] = await Course.aggregate([
      { $match: { instructor: instructorObjectId, isDeleted: false } },
      { $group: { _id: null, courseIds: { $push: "$_id" } } },
      { $project: { _id: 0, courseIds: 1 } },
    ]);

    const courseIds = courseStats?.courseIds ?? [];

    const modules = await Module.find({
      course: { $in: courseIds },
      deletedAt: null,
    })
      .select("_id")
      .lean();

    const moduleIds = modules.map((module) => module._id);

    return { instructorObjectId, courseIds, moduleIds };
  }

  /* ------------------------------------------------------------------------ */
  /*                      Dashboard Overview (GET /)                          */
  /* ------------------------------------------------------------------------ */

  /**
   * Summary metrics for the dashboard overview.
   * @param {string} instructorId
   */
  async getDashboardOverview(instructorId) {
    const instructorObjectId = new mongoose.Types.ObjectId(instructorId);

    const [courseStats] = await Course.aggregate([
      {
        $match: {
          instructor: instructorObjectId,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalCourses: { $sum: 1 },
          publishedCourses: {
            $sum: {
              $cond: [{ $eq: ["$status", COURSE_STATUS.PUBLISHED] }, 1, 0],
            },
          },
          draftCourses: {
            $sum: {
              $cond: [{ $eq: ["$status", COURSE_STATUS.DRAFT] }, 1, 0],
            },
          },
          courseIds: { $push: "$_id" },
        },
      },
      {
        $project: {
          _id: 0,
          totalCourses: 1,
          publishedCourses: 1,
          draftCourses: 1,
          courseIds: 1,
        },
      },
    ]);

    const courseIds = courseStats?.courseIds ?? [];

    const modules = await Module.find({
      course: { $in: courseIds },
      deletedAt: null,
    })
      .select("_id")
      .lean();

    const moduleIds = modules.map((module) => module._id);

    const [totalLessons, totalQuizzes, studentStats, completionStats] =
      await Promise.all([
        Lesson.countDocuments({
          module: { $in: moduleIds },
          isDeleted: false,
        }),

        Quiz.countDocuments({
          course: { $in: courseIds },
          deletedAt: null,
        }),

        Enrollment.aggregate([
          { $match: { course: { $in: courseIds } } },
          {
            $group: {
              _id: "$student",
              status: { $first: "$status" },
            },
          },
          {
            $group: {
              _id: null,
              totalStudents: { $sum: 1 },
              activeStudents: {
                $sum: {
                  $cond: [
                    { $eq: ["$status", ENROLLMENT_STATUS.ACTIVE] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          { $project: { _id: 0, totalStudents: 1, activeStudents: 1 } },
        ]),

        Progress.aggregate([
          { $match: { course: { $in: courseIds } } },
          {
            $group: {
              _id: null,
              averageCompletionPercentage: {
                $avg: "$completionPercentage",
              },
            },
          },
        ]),
      ]);

    return {
      totalCourses: courseStats?.totalCourses ?? 0,
      publishedCourses: courseStats?.publishedCourses ?? 0,
      draftCourses: courseStats?.draftCourses ?? 0,

      totalModules: modules.length,
      totalLessons,
      totalQuizzes,

      totalStudents: studentStats?.totalStudents ?? 0,
      activeStudents: studentStats?.activeStudents ?? 0,

      completionRate: Number(
        (completionStats?.averageCompletionPercentage ?? 0).toFixed(2)
      ),
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                            Recent Courses                                */
  /* ------------------------------------------------------------------------ */

  /**
   * Paginated list of the instructor's most recent courses.
   * @param {string} instructorId
   * @param {{ page?: number, limit?: number }} [filters]
   */
  async getRecentCourses(instructorId, filters = {}) {
    const { page = 1, limit = 5 } = filters;
    const instructorObjectId = new mongoose.Types.ObjectId(instructorId);
    const skip = (page - 1) * limit;

    const [courses, totalCourses] = await Promise.all([
      Course.find({
        instructor: instructorObjectId,
        isDeleted: false,
      })
        .select(
          "title slug status thumbnail statistics.totalEnrollments statistics.averageRating createdAt"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),

      Course.countDocuments({
        instructor: instructorObjectId,
        isDeleted: false,
      }),
    ]);

    return {
      courses,
      pagination: {
        totalCourses,
        currentPage: Number(page),
        totalPages: Math.ceil(totalCourses / limit),
        limit: Number(limit),
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                          Recent Enrollments                              */
  /* ------------------------------------------------------------------------ */

  /**
   * Paginated list of the most recent enrollments across the instructor's courses.
   * @param {string} instructorId
   * @param {{ page?: number, limit?: number }} [filters]
   */
  async getRecentEnrollments(instructorId, filters = {}) {
    const { page = 1, limit = 10 } = filters;
    const courseIds = await this._getCourseIds(instructorId);
    const skip = (page - 1) * limit;

    const [enrollments, totalEnrollments] = await Promise.all([
      Enrollment.find({ course: { $in: courseIds } })
        .populate("student", "fullName username avatar")
        .populate("course", "title slug thumbnail")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),

      Enrollment.countDocuments({ course: { $in: courseIds } }),
    ]);

    return {
      enrollments,
      pagination: {
        totalEnrollments,
        currentPage: Number(page),
        totalPages: Math.ceil(totalEnrollments / limit),
        limit: Number(limit),
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                              Top Courses                                 */
  /* ------------------------------------------------------------------------ */

  /**
   * Top-performing courses by enrollment count and rating.
   * @param {string} instructorId
   * @param {number} [limit=5]
   */
  async getTopCourses(instructorId, limit = 5) {
    const instructorObjectId = new mongoose.Types.ObjectId(instructorId);

    return Course.aggregate([
      {
        $match: {
          instructor: instructorObjectId,
          isDeleted: false,
        },
      },
      {
        $lookup: {
          from: "enrollments",
          localField: "_id",
          foreignField: "course",
          as: "enrollments",
        },
      },
      {
        $lookup: {
          from: "progresses",
          localField: "_id",
          foreignField: "course",
          as: "progress",
        },
      },
      {
        $addFields: {
          totalEnrollments: {
            $size: "$enrollments",
          },
          completionRate: {
            $round: [
              {
                $ifNull: [
                  {
                    $avg: "$progress.completionPercentage",
                  },
                  0,
                ],
              },
              2,
            ],
          },
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          slug: 1,
          thumbnail: 1,
          status: 1,
          totalEnrollments: 1,
          completionRate: 1,
          averageRating: "$statistics.averageRating",
        },
      },
      {
        $sort: {
          totalEnrollments: -1,
          averageRating: -1,
        },
      },
      {
        $limit: Number(limit),
      },
    ]);
  }

  /* ------------------------------------------------------------------------ */
  /*                         Monthly Enrollments                              */
  /* ------------------------------------------------------------------------ */

  /**
   * Monthly enrollment counts for the instructor's courses, optionally for a year.
   * @param {string} instructorId
   * @param {{ year?: number }} [filters]
   */
  async getMonthlyEnrollments(instructorId, filters = {}) {
    const { year } = filters;
    const courseIds = await this._getCourseIds(instructorId);

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
  }

  /* ------------------------------------------------------------------------ */
  /*                         Engagement Analytics                             */
  /* ------------------------------------------------------------------------ */

  /**
   * High-level student engagement statistics.
   * @param {string} instructorId
   */
  async getEngagementStats(instructorId) {
    const courseIds = await this._getCourseIds(instructorId);

    const [studentStats, completionStats] = await Promise.all([
      Enrollment.aggregate([
        { $match: { course: { $in: courseIds } } },
        {
          $group: {
            _id: "$student",
            status: { $first: "$status" },
          },
        },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            activeStudents: {
              $sum: {
                $cond: [
                  { $eq: ["$status", ENROLLMENT_STATUS.ACTIVE] },
                  1,
                  0,
                ],
              },
            },
            completedStudents: {
              $sum: {
                $cond: [
                  { $eq: ["$status", ENROLLMENT_STATUS.COMPLETED] },
                  1,
                  0,
                ],
              },
            },
            droppedStudents: {
              $sum: {
                $cond: [
                  { $eq: ["$status", ENROLLMENT_STATUS.DROPPED] },
                  1,
                  0,
                ],
              },
            },
            suspendedStudents: {
              $sum: {
                $cond: [
                  { $eq: ["$status", ENROLLMENT_STATUS.SUSPENDED] },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalStudents: 1,
            activeStudents: 1,
            completedStudents: 1,
            droppedStudents: 1,
            suspendedStudents: 1,
          },
        },
      ]),

      Progress.aggregate([
        { $match: { course: { $in: courseIds } } },
        {
          $group: {
            _id: null,
            averageCompletionPercentage: {
              $avg: "$completionPercentage",
            },
          },
        },
      ]),
    ]);

    return {
      activeStudents: studentStats?.activeStudents ?? 0,
      completedStudents: studentStats?.completedStudents ?? 0,
      droppedStudents: studentStats?.droppedStudents ?? 0,
      suspendedStudents: studentStats?.suspendedStudents ?? 0,
      averageCompletionRate: Number(
        (completionStats?.averageCompletionPercentage ?? 0).toFixed(2)
      ),
    };
  }

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
  }

  /* ------------------------------------------------------------------------ */
  /*                            Action Center                                 */
  /* ------------------------------------------------------------------------ */

  /**
   * Items that require the instructor's attention.
   * @param {string} instructorId
   */
  async getActionCenter(instructorId) {
    const { courseIds, moduleIds } = await this._getCourseScope(instructorId);
    const instructorObjectId = new mongoose.Types.ObjectId(instructorId);

    const [
      draftCourses,
      unpublishedModules,
      unpublishedLessons,
      unpublishedQuizzes,
      coursesWithoutModules,
      modulesWithoutLessons,
      coursesReadyToPublish,
    ] = await Promise.all([
      Course.countDocuments({
        instructor: instructorObjectId,
        isDeleted: false,
        status: COURSE_STATUS.DRAFT,
      }),

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

      Quiz.countDocuments({
        course: { $in: courseIds },
        deletedAt: null,
        status: "DRAFT",
      }),

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
                  cond: { $eq: ["$$quiz.status", "PUBLISHED"] },
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
      draftCourses,
      unpublishedModules,
      unpublishedLessons,
      unpublishedQuizzes,
      coursesWithoutModules: coursesWithoutModules[0]?.count ?? 0,
      modulesWithoutLessons: modulesWithoutLessons[0]?.count ?? 0,
      coursesReadyToPublish: coursesReadyToPublish[0]?.count ?? 0,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                         Composite (Legacy) Overview                      */
  /* ------------------------------------------------------------------------ */

  /**
   * Full dashboard payload. Composes all isolated analytics into one response
   * for clients that still consume a single aggregated endpoint.
   * @param {string} instructorId
   */
  async getDashboardStats(instructorId) {
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
      this.getDashboardOverview(instructorId),
      this.getRecentCourses(instructorId, { page: 1, limit: 5 }),
      this.getRecentEnrollments(instructorId, { page: 1, limit: 10 }),
      this.getMonthlyEnrollments(instructorId),
      this.getTopCourses(instructorId, 5),
      this.getEngagementStats(instructorId),
      this.getEarningsStats(instructorId),
      this.getActionCenter(instructorId),
    ]);

    return {
      ...overview,
      recentCourses: recentCourses.courses,
      recentEnrollments: recentEnrollments.enrollments,
      monthlyEnrollments: monthly.monthlyEnrollments,
      topCourses,
      engagement,
      earnings,
      actionCenter,
    };
  }
}

export default new DashboardService();
