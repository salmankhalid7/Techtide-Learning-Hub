/**
 * @file dashboard.instructor.overview.js
 * @description Instructor dashboard overview + list endpoints.
 *
 * Instructor-scoped methods for the summary overview, recent courses, recent
 * enrollments and top courses. Exported as a plain object that the facade
 * mixes onto its prototype, so `this._resolveScope`, `this._aggregateEnrollmentStatus`,
 * `this._aggregateCompletionRate` (from the helper files) resolve at runtime.
 */

import mongoose from "mongoose";

import {
  Course,
  Lesson,
  Quiz,
  Enrollment,
  COURSE_STATUS,
  DEFAULT_PAGE,
  DEFAULT_RECENT_COURSES_LIMIT,
  DEFAULT_RECENT_ENROLLMENTS_LIMIT,
  DEFAULT_TOP_COURSES_LIMIT,
  COURSE_LIST_PROJECTION,
} from "./dashboard.constants.js";

const instructorOverview = {
  /* ------------------------------------------------------------------------ */
  /*                      Dashboard Overview (GET /)                          */
  /* ------------------------------------------------------------------------ */

  /**
   * Summary metrics for the dashboard overview.
   * @param {string} instructorId
   */
  async getDashboardOverview(instructorId, _scope) {
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
    const { moduleIds } = await this._resolveScope(instructorId, _scope);

    const [totalLessons, totalQuizzes, studentStats, completionRate] =
      await Promise.all([
        Lesson.countDocuments({
          module: { $in: moduleIds },
          isDeleted: false,
        }),

        Quiz.countDocuments({
          course: { $in: courseIds },
          deletedAt: null,
        }),

        this._aggregateEnrollmentStatus(courseIds),

        this._aggregateCompletionRate(courseIds),
      ]);

    return {
      totalCourses: courseStats?.totalCourses ?? 0,
      publishedCourses: courseStats?.publishedCourses ?? 0,
      draftCourses: courseStats?.draftCourses ?? 0,

      totalModules: moduleIds.length,
      totalLessons,
      totalQuizzes,

      totalStudents: studentStats.totalStudents,
      activeStudents: studentStats.activeStudents,

      completionRate,
    };
  },

  /* ------------------------------------------------------------------------ */
  /*                            Recent Courses                                */
  /* ------------------------------------------------------------------------ */

  /**
   * Paginated list of the instructor's most recent courses.
   * @param {string} instructorId
   * @param {{
   *   page?: number,
   *   limit?: number,
   *   search?: string,
   *   status?: string,
   *   sortBy?: string,
   *   sortOrder?: "asc" | "desc",
   * }} [filters]
   */
  async getRecentCourses(instructorId, filters = {}) {
    const {
      page = DEFAULT_PAGE,
      limit = DEFAULT_RECENT_COURSES_LIMIT,
      search,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;
    const instructorObjectId = new mongoose.Types.ObjectId(instructorId);
    const skip = (page - 1) * limit;

    const filter = {
      instructor: instructorObjectId,
      isDeleted: false,
    };

    // Free-text filter over title/slug (case-insensitive substring).
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: regex }, { slug: regex }];
    }

    // Optional status filter; accepts lowercase values like the Course schema.
    if (status && status in COURSE_STATUS) {
      filter.status = COURSE_STATUS[status];
    }

    // Whitelist sortable fields to avoid arbitrary projection injection.
    const sortableFields = new Set(["createdAt", "updatedAt", "title"]);
    const direction = sortOrder === "asc" ? 1 : -1;
    const sortField = sortableFields.has(sortBy) ? sortBy : "createdAt";

    const [courses, totalCourses] = await Promise.all([
      Course.find(filter)
        .select(COURSE_LIST_PROJECTION)
        .sort({ [sortField]: direction })
        .skip(skip)
        .limit(Number(limit))
        .lean(),

      Course.countDocuments(filter),
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
  },

  /* ------------------------------------------------------------------------ */
  /*                          Recent Enrollments                              */
  /* ------------------------------------------------------------------------ */

  /**
   * Paginated list of the most recent enrollments across the instructor's courses.
   * @param {string} instructorId
   * @param {{ page?: number, limit?: number }} [filters]
   */
  async getRecentEnrollments(instructorId, filters = {}, _scope) {
    const {
      page = DEFAULT_PAGE,
      limit = DEFAULT_RECENT_ENROLLMENTS_LIMIT,
    } = filters;
    const courseIds = (await this._resolveScope(instructorId, _scope)).courseIds;
    const skip = (page - 1) * limit;

    const [enrollments, totalEnrollments] = await Promise.all([
      Enrollment.find({ course: { $in: courseIds } })
        .populate("student", "fullName username avatar")
        .populate("course", "title slug thumbnail")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .read("secondaryPreferred")
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
  },

  /* ------------------------------------------------------------------------ */
  /*                              Top Courses                                 */
  /* ------------------------------------------------------------------------ */

  /**
   * Top-performing courses by enrollment count and rating.
   * @param {string} instructorId
   * @param {number} [limit=DEFAULT_TOP_COURSES_LIMIT]
   */
  async getTopCourses(instructorId, limit = DEFAULT_TOP_COURSES_LIMIT) {
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
  },
};

export default instructorOverview;
