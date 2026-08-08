import mongoose from "mongoose";

import User from "../models/user.model.js";
import Course from "../models/course.model.js";
import Module from "../models/module.model.js";
import Lesson from "../models/lesson.model.js";
import Quiz, { QUIZ_STATUS } from "../models/quiz.model.js";
import Question from "../models/question.model.js";
import Enrollment from "../models/enrollment.model.js";
import Progress from "../models/progress.model.js";
import Attempt from "../models/attempt.model.js";

import { COURSE_STATUS } from "../constants/course.constants.js";
import { ENROLLMENT_STATUS } from "../constants/enrollment.constants.js";
import { MODULE_STATUS } from "../constants/module.constants.js";
import { LESSON_STATUS_ENUM } from "../constants/lesson.constants.js";
import { ATTEMPT_STATUS } from "../constants/attempt.constants.js";
import constants from "../config/constants.js";

/* ---------------------------- Shared constants ---------------------------- */

/** Default pagination values. */
const DEFAULT_PAGE = 1;
const DEFAULT_RECENT_COURSES_LIMIT = 5;
const DEFAULT_RECENT_ENROLLMENTS_LIMIT = 10;
const DEFAULT_TOP_COURSES_LIMIT = 5;

/** How many of the most recent registrations to include in user analytics. */
const RECENT_USERS_LIMIT = 10;

/** Default cap for analytics list helpers (popular, rated, recent, etc.). */
const DEFAULT_ANALYTICS_LIMIT = 10;

/** How many of the most recent activities to include from each collection. */
const RECENT_ACTIVITY_PER_SOURCE = 10;

/** Total number of activities returned by the recent-activity timeline. */
const RECENT_ACTIVITY_TOTAL = 20;

/** Course fields projected for list-style dashboard responses. */
const COURSE_LIST_PROJECTION =
  "title slug status thumbnail statistics.totalEnrollments statistics.averageRating createdAt";

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

  /**
   * Resolve the instructor scope, honoring an already-resolved scope when the
   * caller (e.g. the composite `getDashboardStats`) passes one. This lets the
   * composite fetch the instructor's course/module IDs once and share them with
   * all its sub-queries instead of running an identical aggregation per query.
   * @param {string|import("mongoose").Types.ObjectId} instructorId
   * @param {InstructorScope} [scope] Optional pre-resolved scope.
   * @returns {Promise<InstructorScope>}
   */
  _resolveScope(instructorId, scope) {
    return scope ?? this._getCourseScope(instructorId);
  }

  /**
   * Platform-wide user summary counts.
   *
   * Shared by the admin overview and the user analytics so the user metrics
   * live in a single place and future additions (e.g. verifiedUsers) only need
   * to be made here.
   * @returns {Promise<{ totalUsers: number, totalStudents: number, totalInstructors: number, totalAdmins: number, activeUsers: number, blockedUsers: number }>}
   */
  async _getUserSummary() {
    const [
      totalUsers,
      totalStudents,
      totalInstructors,
      totalAdmins,
      activeUsers,
      blockedUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: constants.ROLES.STUDENT }),
      User.countDocuments({ role: constants.ROLES.INSTRUCTOR }),
      User.countDocuments({ role: constants.ROLES.ADMIN }),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isBlocked: true }),
    ]);

    return {
      totalUsers,
      totalStudents,
      totalInstructors,
      totalAdmins,
      activeUsers,
      blockedUsers,
    };
  }

  /**
   * Get monthly document counts grouped by the document's `createdAt` year +
   * month. Reusable across analytics (users, courses, enrollments, etc.) so a
   * single helper powers every "per month" chart instead of six near-identical
   * pipelines.
   *
   * Returns clean objects (the `_id` wrapping is flattened away) like:
   * `[{ year: 2026, month: 1, count: 15 }, ...]`, sorted ascending.
   *
   * @param {import("mongoose").Model} model
   * @param {Object} [match={}] Optional match filter applied before grouping.
   * @returns {Promise<Array<{ year: number, month: number, count: number }>>}
   */
  async _getMonthlyCounts(model, match = {}) {
    const results = await model.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    return results.map((item) => ({
      year: item._id.year,
      month: item._id.month,
      count: item.count,
    }));
  }

  /**
   * Platform-wide course summary counts.
   *
   * Shared by the admin overview and the course analytics so the course
   * metrics live in a single place. Excludes soft-deleted courses
   * (`isDeleted: false`), since `countDocuments` does not run find middleware.
   * @returns {Promise<{ totalCourses: number, publishedCourses: number, draftCourses: number, archivedCourses: number }>}
   */
  async _getCourseSummary() {
    const [
      totalCourses,
      publishedCourses,
      draftCourses,
      archivedCourses,
    ] = await Promise.all([
      Course.countDocuments({ isDeleted: false }),
      Course.countDocuments({ isDeleted: false, status: COURSE_STATUS.PUBLISHED }),
      Course.countDocuments({ isDeleted: false, status: COURSE_STATUS.DRAFT }),
      Course.countDocuments({ isDeleted: false, status: COURSE_STATUS.ARCHIVED }),
    ]);

    return {
      totalCourses,
      publishedCourses,
      draftCourses,
      archivedCourses,
    };
  }

  /**
   * Platform-wide enrollment summary counts.
   *
   * Shared by the admin overview and the enrollment analytics so the
   * enrollment metrics live in a single place. Enrollment has no soft-delete.
   * @returns {Promise<{ totalEnrollments: number, activeEnrollments: number, completedEnrollments: number }>}
   */
  async _getEnrollmentSummary() {
    const [totalEnrollments, activeEnrollments, completedEnrollments] =
      await Promise.all([
        Enrollment.countDocuments(),
        Enrollment.countDocuments({ status: ENROLLMENT_STATUS.ACTIVE }),
        Enrollment.countDocuments({ status: ENROLLMENT_STATUS.COMPLETED }),
      ]);

    return {
      totalEnrollments,
      activeEnrollments,
      completedEnrollments,
    };
  }

  /**
   * Courses that don't have any modules (platform-wide).
   *
   * Uses a `$lookup` aggregation instead of an N+1 loop. Most modules are
   * soft-deleted via `deletedAt: null`, so only non-deleted modules count as
   * "having modules".
   * @returns {Promise<Array<{ _id, title, slug, status, createdAt }>>}
   */
  async _getCoursesWithoutModules() {
    return Course.aggregate([
      { $match: { isDeleted: false } },
      {
        $lookup: {
          from: "modules",
          localField: "_id",
          foreignField: "course",
          let: { courseId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$course", "$$courseId"] }, deletedAt: null } },
          ],
          as: "modules",
        },
      },
      { $match: { modules: { $size: 0 } } },
      {
        $project: {
          title: 1,
          slug: 1,
          status: 1,
          createdAt: 1,
        },
      },
    ]);
  }

  /**
   * Modules that don't contain any lessons (platform-wide).
   *
   * Uses a `$lookup` aggregation (no N+1). Only non-soft-deleted modules and
   * lessons count, so a module whose lessons were all deleted is correctly
   * flagged. Populates the parent course title/slug for immediate use.
   * @returns {Promise<Array<{ _id, title, order, createdAt, course: { _id, title, slug } }>>}
   */
  async _getModulesWithoutLessons() {
    return Module.aggregate([
      { $match: { deletedAt: null } },
      {
        $lookup: {
          from: "lessons",
          localField: "_id",
          foreignField: "module",
          let: { moduleId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$module", "$$moduleId"] }, isDeleted: false } },
          ],
          as: "lessons",
        },
      },
      { $match: { lessons: { $size: 0 } } },
      {
        $lookup: {
          from: "courses",
          localField: "course",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },
      {
        $project: {
          title: 1,
          order: 1,
          createdAt: 1,
          course: {
            _id: "$course._id",
            title: "$course.title",
            slug: "$course.slug",
          },
        },
      },
    ]);
  }

  /**
   * Lessons that have no meaningful content for their lesson type
   * (platform-wide).
   *
   * The Lesson schema stores content in a typed sub-document (`content.video`,
   * `content.text`, `content.pdf`, `content.audio`, `content.externalLink`).
   * A lesson is considered empty when its type-specific sub-document is
   * missing/null, or its required field (e.g. `url`/`body`) is empty/null.
   *
   * Uses a single aggregation (no N+1) and populates the parent module + course.
   * @returns {Promise<Array<{ _id, title, order, lessonType, createdAt, module: { _id, title, course: { _id, title, slug } } }>>}
   */
  async _getLessonsWithoutContent() {
    return Lesson.aggregate([
      { $match: { isDeleted: false } },
      {
        $match: {
          $or: [
            {
              lessonType: "VIDEO",
              $or: [
                { "content.video": { $exists: false } },
                { "content.video": null },
                { "content.video.url": { $in: ["", null] } },
              ],
            },
            {
              lessonType: "TEXT",
              $or: [
                { "content.text": { $exists: false } },
                { "content.text": null },
                { "content.text.body": { $in: ["", null] } },
              ],
            },
            {
              lessonType: "PDF",
              $or: [
                { "content.pdf": { $exists: false } },
                { "content.pdf": null },
                { "content.pdf.url": { $in: ["", null] } },
              ],
            },
            {
              lessonType: "AUDIO",
              $or: [
                { "content.audio": { $exists: false } },
                { "content.audio": null },
                { "content.audio.url": { $in: ["", null] } },
              ],
            },
            {
              lessonType: "EXTERNAL_LINK",
              $or: [
                { "content.externalLink": { $exists: false } },
                { "content.externalLink": null },
                { "content.externalLink.url": { $in: ["", null] } },
              ],
            },
          ],
        },
      },
      {
        $lookup: {
          from: "modules",
          localField: "module",
          foreignField: "_id",
          as: "module",
        },
      },
      { $unwind: { path: "$module", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "courses",
          localField: "module.course",
          foreignField: "_id",
          as: "module.course",
        },
      },
      { $unwind: { path: "$module.course", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          title: 1,
          order: 1,
          lessonType: 1,
          createdAt: 1,
          module: {
            _id: "$module._id",
            title: "$module.title",
            course: {
              _id: "$module.course._id",
              title: "$module.course.title",
              slug: "$module.course.slug",
            },
          },
        },
      },
    ]);
  }

  /**
   * Draft courses that are ready for review/publishing.
   *
   * Simple rule: course is in DRAFT and has at least one (non-soft-deleted)
   * module. This can be strengthened later (all modules have lessons,
   * thumbnail present, pricing complete, etc.) without changing the API shape.
   * @returns {Promise<Array<{ _id, title, slug, status, createdAt, totalModules }>>}
   */
  async _getDraftCoursesReadyForPublishing() {
    return Course.aggregate([
      { $match: { isDeleted: false, status: COURSE_STATUS.DRAFT } },
      {
        $lookup: {
          from: "modules",
          localField: "_id",
          foreignField: "course",
          let: { courseId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$course", "$$courseId"] }, deletedAt: null } },
          ],
          as: "modules",
        },
      },
      { $match: { "modules.0": { $exists: true } } },
      {
        $project: {
          title: 1,
          slug: 1,
          status: 1,
          createdAt: 1,
          totalModules: { $size: "$modules" },
        },
      },
    ]);
  }

  /**
   * Most popular courses by enrollment count.
   *
   * Groups enrollments by course, counts them, sorts descending, then joins
   * the course details. Popularity is based on actual enrollments — not views
   * or creation date.
   * @param {number} [limit=DEFAULT_ANALYTICS_LIMIT]
   * @returns {Promise<Array<{ _id, title, slug, thumbnail, status, totalEnrollments }>>}
   */
  async _getMostPopularCourses(limit = DEFAULT_ANALYTICS_LIMIT) {
    return Enrollment.aggregate([
      {
        $group: {
          _id: "$course",
          totalEnrollments: { $sum: 1 },
        },
      },
      { $sort: { totalEnrollments: -1 } },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: "courses",
          localField: "_id",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },
      {
        $project: {
          _id: "$course._id",
          title: "$course.title",
          slug: "$course.slug",
          thumbnail: "$course.thumbnail",
          status: "$course.status",
          totalEnrollments: 1,
        },
      },
    ]);
  }

  /**
   * Least popular courses by enrollment count.
   *
   * Aggregates from the Course collection (not Enrollment) so courses with
   * zero enrollments are included — those are usually the ones an admin needs
   * to identify. Sorted by fewest enrollments first, then most recently
   * created, to break ties predictably.
   * @param {number} [limit=DEFAULT_ANALYTICS_LIMIT]
   * @returns {Promise<Array<{ _id, title, slug, thumbnail, status, totalEnrollments }>>}
   */
  async _getLeastPopularCourses(limit = DEFAULT_ANALYTICS_LIMIT) {
    return Course.aggregate([
      { $match: { isDeleted: false } },
      {
        $lookup: {
          from: "enrollments",
          localField: "_id",
          foreignField: "course",
          as: "enrollments",
        },
      },
      {
        $addFields: {
          totalEnrollments: { $size: "$enrollments" },
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          slug: 1,
          status: 1,
          thumbnail: 1,
          totalEnrollments: 1,
        },
      },
      { $sort: { totalEnrollments: 1, createdAt: -1 } },
      { $limit: Number(limit) },
    ]);
  }

  /**
   * Most recently published courses.
   *
   * Uses the Course `publishedAt` timestamp (set when a course transitions to
   * PUBLISHED), sorting newest-first. Populates the instructor so admins know
   * who published each course without an extra API call.
   * @param {number} [limit=DEFAULT_ANALYTICS_LIMIT]
   * @returns {Promise<Array>}
   */
  async _getRecentlyPublishedCourses(limit = DEFAULT_ANALYTICS_LIMIT) {
    return Course.find({
      isDeleted: false,
      status: COURSE_STATUS.PUBLISHED,
    })
      .sort({ publishedAt: -1 })
      .limit(Number(limit))
      .select("title slug instructor thumbnail publishedAt createdAt updatedAt")
      .populate({
        path: "instructor",
        select: "fullName email",
      })
      .lean();
  }

  /**
   * Most recently created courses, regardless of status.
   *
   * Sorted by creation date (newest first). Populates the instructor so the
   * frontend has the author details without an extra API call.
   * @param {number} [limit=DEFAULT_ANALYTICS_LIMIT]
   * @returns {Promise<Array>}
   */
  async _getRecentlyCreatedCourses(limit = DEFAULT_ANALYTICS_LIMIT) {
    return Course.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .select("title slug status instructor thumbnail createdAt")
      .populate({
        path: "instructor",
        select: "fullName email",
      })
      .lean();
  }

  /**
   * Highest rated courses.
   *
   * TODO: Replace with an actual aggregation once the Review module is
   * implemented. Deliberately returns an empty array rather than faking
   * ratings that don't exist yet.
   * @returns {Promise<Array>}
   */
  // eslint-disable-next-line no-unused-vars
  async _getHighestRatedCourses() {
    return [];
  }

  /**
   * Aggregate enrollment documents into per-student status buckets.
   * The first pass groups by student (one row per student), the second counts
   * status occurrences across those students. Shared by the overview and
   * engagement analytics so the aggregation lives in a single place.
   * @param {import("mongoose").Types.ObjectId[]} courseIds
   * @returns {Promise<{ totalStudents: number, activeStudents: number, completedStudents: number, droppedStudents: number, suspendedStudents: number }>}
   */
  async _aggregateEnrollmentStatus(courseIds) {
    const [stats] = await Enrollment.aggregate([
      { $match: { course: { $in: courseIds } } },
      { $group: { _id: "$student", status: { $first: "$status" } } },
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          activeStudents: {
            $sum: {
              $cond: [{ $eq: ["$status", ENROLLMENT_STATUS.ACTIVE] }, 1, 0],
            },
          },
          completedStudents: {
            $sum: {
              $cond: [{ $eq: ["$status", ENROLLMENT_STATUS.COMPLETED] }, 1, 0],
            },
          },
          droppedStudents: {
            $sum: {
              $cond: [{ $eq: ["$status", ENROLLMENT_STATUS.DROPPED] }, 1, 0],
            },
          },
          suspendedStudents: {
            $sum: {
              $cond: [{ $eq: ["$status", ENROLLMENT_STATUS.SUSPENDED] }, 1, 0],
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
    ]);

    return {
      totalStudents: stats?.totalStudents ?? 0,
      activeStudents: stats?.activeStudents ?? 0,
      completedStudents: stats?.completedStudents ?? 0,
      droppedStudents: stats?.droppedStudents ?? 0,
      suspendedStudents: stats?.suspendedStudents ?? 0,
    };
  }

  /**
   * Average completion percentage across progress documents for the given
   * courses. Shared by the overview and engagement analytics.
   * @param {import("mongoose").Types.ObjectId[]} courseIds
   * @returns {Promise<number>}
   */
  async _aggregateCompletionRate(courseIds) {
    const [stats] = await Progress.aggregate([
      { $match: { course: { $in: courseIds } } },
      {
        $group: {
          _id: null,
          averageCompletionPercentage: { $avg: "$completionPercentage" },
        },
      },
    ]);

    if (!stats?.averageCompletionPercentage) {
      return 0;
    }

    return Number(Number(stats.averageCompletionPercentage).toFixed(2));
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  /* ------------------------------------------------------------------------ */
  /*                         Admin Overview                                   */
  /* ------------------------------------------------------------------------ */

  /**
   * Platform-wide overview for admins.
   *
   * High-level KPIs only. Detailed analytics (growth, charts, recent
   * activity, etc.) are handled by dedicated endpoints later.
   *
   * @returns {Promise<{
   *   users: { totalUsers, totalStudents, totalInstructors, totalAdmins, activeUsers, blockedUsers },
   *   courses: { totalCourses, publishedCourses, draftCourses, archivedCourses },
   *   content: { totalModules, totalLessons, totalQuizzes, totalQuestions },
   *   enrollments: { totalEnrollments, activeEnrollments, completedEnrollments },
   *   completions: { totalCourseCompletions }
   * }>}
   */
  async getAdminOverview() {
    // Content & completion statistics run in parallel via Promise.all; user,
    // course, and enrollment summaries are provided by their shared helpers.
    const [totalModules, totalLessons, totalQuizzes, totalQuestions, totalCourseCompletions] =
      await Promise.all([
        Module.countDocuments({ deletedAt: null }),
        Lesson.countDocuments({ isDeleted: false }),
        Quiz.countDocuments({ deletedAt: null }),
        Question.countDocuments({ deletedAt: null }),
        Progress.countDocuments({ isCourseCompleted: true }),
      ]);

    const [users, courses, enrollments] = await Promise.all([
      this._getUserSummary(),
      this._getCourseSummary(),
      this._getEnrollmentSummary(),
    ]);

    return {
      users,

      courses,

      content: {
        totalModules,
        totalLessons,
        totalQuizzes,
        totalQuestions,
      },

      enrollments,

      completions: {
        totalCourseCompletions,
      },
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                             User Analytics                               */
  /* ------------------------------------------------------------------------ */

  /**
   * User analytics for admins.
   *
   * Grouped response so the frontend can consume growth/trend data easily.
   * Detailed queries (new users per month, growth, recent users) are added
   * incrementally.
   *
   * @param {Object} query
   * @returns {Promise<{
   *   summary: { totalUsers, totalStudents, totalInstructors, totalAdmins, activeUsers, blockedUsers },
   *   growth: { users: [], students: [], instructors: [] },
   *   recentRegistrations: [],
   *   recentlyActiveUsers: []
   * }>}
   */
  async getUserAnalytics(query) {
    const [
      summary,
      newUsersPerMonth,
      studentGrowth,
      instructorGrowth,
      recentRegistrations,
      recentlyActiveUsers,
    ] = await Promise.all([
      this._getUserSummary(),
      this._getMonthlyCounts(User),
      this._getMonthlyCounts(User, { role: constants.ROLES.STUDENT }),
      this._getMonthlyCounts(User, { role: constants.ROLES.INSTRUCTOR }),

      // Latest registrations (lightweight, read-only, plain JS objects).
      User.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(RECENT_USERS_LIMIT)
        .select("fullName email avatar role isActive isEmailVerified createdAt")
        .lean(),

      // Most recently active users, based on `lastLogin` (only users who have
      // logged in at least once).
      User.find({ lastLogin: { $exists: true }, isDeleted: false })
        .sort({ lastLogin: -1 })
        .limit(RECENT_USERS_LIMIT)
        .select("fullName email avatar role isActive lastLogin")
        .lean(),
    ]);

    return {
      summary,

      growth: {
        users: newUsersPerMonth,
        students: studentGrowth,
        instructors: instructorGrowth,
      },

      recentRegistrations,

      recentlyActiveUsers,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                            Course Analytics                              */
  /* ------------------------------------------------------------------------ */

  /**
   * Course analytics for admins.
   *
   * @param {Object} query
   * @returns {Promise<{
   *   summary: { totalCourses, publishedCourses, draftCourses, archivedCourses },
   *   popularCourses: [],
   *   leastPopularCourses: [],
   *   highestRatedCourses: [],
   *   recentlyPublishedCourses: [],
   *   recentlyCreatedCourses: []
   * }>}
   */
  async getCourseAnalytics(query) {
    const [
      summary,
      popularCourses,
      leastPopularCourses,
      highestRatedCourses,
      recentlyPublishedCourses,
      recentlyCreatedCourses,
    ] = await Promise.all([
      this._getCourseSummary(),
      this._getMostPopularCourses(),
      this._getLeastPopularCourses(),
      this._getHighestRatedCourses(),
      this._getRecentlyPublishedCourses(),
      this._getRecentlyCreatedCourses(),
    ]);

    return {
      summary,

      popularCourses,

      leastPopularCourses,

      highestRatedCourses,

      recentlyPublishedCourses,

      recentlyCreatedCourses,
    };
  }

  /* ------------------------------------------------------------------------ */
  /*                         Enrollment Analytics                             */
  /* ------------------------------------------------------------------------ */

  /**
   * Enrollment analytics for admins.
   *
   * Focused on enrollment trends and completion (completion rate, drop rate),
   * not course details.
   *
   * @param {Object} query
   * @returns {Promise<{
   *   summary: { totalEnrollments, activeEnrollments, completedEnrollments },
   *   monthlyEnrollments: [],
   *   completionRate: {},
   *   dropRate: {}
   * }>}
   */
  async getEnrollmentAnalytics(query) {
    const [summary, monthlyEnrollments, droppedEnrollments] = await Promise.all([
      this._getEnrollmentSummary(),
      this._getMonthlyCounts(Enrollment),
      Enrollment.countDocuments({ status: ENROLLMENT_STATUS.DROPPED }),
    ]);

    // Completion rate derived from the already-fetched summary — no extra query.
    const completionRate =
      summary.totalEnrollments === 0
        ? 0
        : Number(
            ((summary.completedEnrollments / summary.totalEnrollments) * 100).toFixed(2)
          );

    const dropRate =
      summary.totalEnrollments === 0
        ? 0
        : Number(((droppedEnrollments / summary.totalEnrollments) * 100).toFixed(2));

    return {
      summary,

      monthlyEnrollments,

      completionRate: {
        percentage: completionRate,
        completed: summary.completedEnrollments,
        total: summary.totalEnrollments,
      },

      dropRate: {
        percentage: dropRate,
        dropped: droppedEnrollments,
        total: summary.totalEnrollments,
      },
    };
  }

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
  }

  /**
   * Build a consolidated list of platform issues from the issue buckets.
   *
   * Generated dynamically (not stored) so it always stays consistent with the
   * underlying data.
   * @param {{
   *   coursesWithoutModules: Array,
   *   modulesWithoutLessons: Array,
   *   lessonsWithoutContent: Array,
   *   draftCoursesReadyForPublishing: Array
   * }} issues
   * @returns {Array<{ type: string, severity: "HIGH"|"MEDIUM"|"LOW", count: number }>}
   */
  _buildFlaggedItems(issues) {
    const flaggedItems = [];

    if (issues.coursesWithoutModules.length) {
      flaggedItems.push({
        type: "COURSES_WITHOUT_MODULES",
        severity: "HIGH",
        count: issues.coursesWithoutModules.length,
      });
    }

    if (issues.modulesWithoutLessons.length) {
      flaggedItems.push({
        type: "MODULES_WITHOUT_LESSONS",
        severity: "HIGH",
        count: issues.modulesWithoutLessons.length,
      });
    }

    if (issues.lessonsWithoutContent.length) {
      flaggedItems.push({
        type: "LESSONS_WITHOUT_CONTENT",
        severity: "MEDIUM",
        count: issues.lessonsWithoutContent.length,
      });
    }

    if (issues.draftCoursesReadyForPublishing.length) {
      flaggedItems.push({
        type: "COURSES_READY_TO_PUBLISH",
        severity: "LOW",
        count: issues.draftCoursesReadyForPublishing.length,
      });
    }

    return flaggedItems;
  }

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
  }

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
  }

  /* ------------------------------------------------------------------------ */
  /*                             Action Center                                */
  /* ------------------------------------------------------------------------ */

  /**
   * Priority ordering used to sort admin actions (highest first).
   */
  static get PRIORITY_ORDER() {
    return { HIGH: 1, MEDIUM: 2, LOW: 3 };
  }

  /**
   * Admin action center.
   *
   * Returns a list of actionable, prioritized tasks for the admin — built from
   * counts/issues that already have dedicated admin analytics (blocked users,
   * unverified instructors, draft courses, content gaps, etc.). No raw data is
   * returned; only tasks that require attention.
   *
   * @returns {Promise<Array<{ type: string, priority: "HIGH"|"MEDIUM"|"LOW", count: number, message: string }>>}
   */
  async getAdminActionCenter() {
    const actions = [];

    const [
      blockedUsers,
      unverifiedInstructors,
      draftCourses,
      coursesWithoutModules,
      modulesWithoutLessons,
      lessonsWithoutContent,
      draftCoursesReadyForPublishing,
    ] = await Promise.all([
      // Blocked users require review (`isBlocked` field on the User model).
      User.countDocuments({ isBlocked: true }),

      // Instructors that have not verified their email yet.
      User.countDocuments({
        role: constants.ROLES.INSTRUCTOR,
        isEmailVerified: false,
      }),

      // Draft courses may need to be reviewed/published.
      Course.countDocuments({ isDeleted: false, status: COURSE_STATUS.DRAFT }),

      this._getCoursesWithoutModules(),
      this._getModulesWithoutLessons(),
      this._getLessonsWithoutContent(),
      this._getDraftCoursesReadyForPublishing(),
    ]);

    if (blockedUsers > 0) {
      actions.push({
        type: "BLOCKED_USERS",
        priority: "HIGH",
        count: blockedUsers,
        message: `${blockedUsers} blocked users require review.`,
      });
    }

    if (unverifiedInstructors > 0) {
      actions.push({
        type: "UNVERIFIED_INSTRUCTORS",
        priority: "HIGH",
        count: unverifiedInstructors,
        message: `${unverifiedInstructors} instructors are awaiting verification.`,
      });
    }

    if (draftCourses > 0) {
      actions.push({
        type: "DRAFT_COURSES",
        priority: "MEDIUM",
        count: draftCourses,
        message: `${draftCourses} draft courses need review.`,
      });
    }

    if (coursesWithoutModules.length) {
      actions.push({
        type: "COURSES_WITHOUT_MODULES",
        priority: "HIGH",
        count: coursesWithoutModules.length,
        message: "Some courses have no modules.",
      });
    }

    if (modulesWithoutLessons.length) {
      actions.push({
        type: "MODULES_WITHOUT_LESSONS",
        priority: "HIGH",
        count: modulesWithoutLessons.length,
        message: "Some modules have no lessons.",
      });
    }

    if (lessonsWithoutContent.length) {
      actions.push({
        type: "LESSONS_WITHOUT_CONTENT",
        priority: "MEDIUM",
        count: lessonsWithoutContent.length,
        message: "Some lessons are missing content.",
      });
    }

    if (draftCoursesReadyForPublishing.length) {
      actions.push({
        type: "READY_TO_PUBLISH",
        priority: "LOW",
        count: draftCoursesReadyForPublishing.length,
        message: "Courses are ready for publishing.",
      });
    }

    const { PRIORITY_ORDER } = DashboardService;

    actions.sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    );

    return actions;
  }

  /* ------------------------------------------------------------------------ */
  /*                            Composite Dashboard                           */
  /* ------------------------------------------------------------------------ */

  /**
   * Complete admin dashboard.
   *
   * Orchestrates all the individually-built admin analytics endpoints into a
   * single payload — it does NOT duplicate any logic. Each section delegates
   * to its dedicated method, and since every one of these queries is
   * independent, `Promise.all` lets MongoDB process them concurrently rather
   * than serially.
   *
   * @param {Object} [query={}] Optional shared query params (passed through to
   *   the analytics methods that accept them).
   * @returns {Promise<Object>}
   */
  async getAdminDashboard(query = {}) {
    const [
      overview,
      userAnalytics,
      courseAnalytics,
      enrollmentAnalytics,
      platformHealth,
      revenue,
      recentActivity,
      actionCenter,
    ] = await Promise.all([
      this.getAdminOverview(query),
      this.getUserAnalytics(query),
      this.getCourseAnalytics(query),
      this.getEnrollmentAnalytics(query),
      this.getPlatformHealth(),
      this.getRevenueAnalytics(query),
      this.getRecentActivity(query),
      this.getAdminActionCenter(),
    ]);

    return {
      overview,
      userAnalytics,
      courseAnalytics,
      enrollmentAnalytics,
      platformHealth,
      revenue,
      recentActivity,
      actionCenter,
    };
  }
}

export default new DashboardService();