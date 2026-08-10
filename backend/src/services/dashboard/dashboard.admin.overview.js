/**
 * @file dashboard.admin.overview.js
 * @description Admin overview + analytics endpoints.
 *
 * Admin-scoped methods for the platform overview, and the user / course /
 * enrollment analytics. Exported as a plain object that the facade mixes onto
 * its prototype, so `this._getUserSummary`, `this._getMonthlyCounts`, etc.
 * (from the helper files) resolve at runtime.
 */

import {
  User,
  Course,
  Module,
  Lesson,
  Quiz,
  Question,
  Enrollment,
  Progress,
  ENROLLMENT_STATUS,
  constants,
  RECENT_USERS_LIMIT,
} from "./dashboard.constants.js";

const adminOverview = {
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
  },

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
  },

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
  },

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
  },
};

export default adminOverview;
