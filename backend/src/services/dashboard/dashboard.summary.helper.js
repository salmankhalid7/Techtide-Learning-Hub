/**
 * @file dashboard.summary.helper.js
 * @description Platform-wide summary + monthly-count helpers.
 *
 * Shared by the admin overview and the various admin analytics methods. Mixed
 * onto the facade prototype, so `this._getUserSummary()`, `this._getMonthlyCounts()`,
 * etc. resolve at runtime.
 */

import { User, Course, Enrollment, COURSE_STATUS, ENROLLMENT_STATUS, constants } from "./dashboard.constants.js";

const summaryHelpers = {
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
  },

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
  },

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
  },

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
  },
};

export default summaryHelpers;
