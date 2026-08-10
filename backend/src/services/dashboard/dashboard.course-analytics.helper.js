/**
 * @file dashboard.course-analytics.helper.js
 * @description Course-related analytics and platform-issue helpers.
 *
 * Groups all course-focused aggregation helpers used by the admin course
 * analytics, platform health, and action center. Mixed onto the facade
 * prototype, so `this._getCoursesWithoutModules()`, `this._getMostPopularCourses()`,
 * etc. resolve at runtime.
 */

import {
  Course,
  Module,
  Lesson,
  Enrollment,
  COURSE_STATUS,
  DEFAULT_ANALYTICS_LIMIT,
} from "./dashboard.constants.js";

const courseAnalyticsHelpers = {
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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },

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
  },
};

export default courseAnalyticsHelpers;
