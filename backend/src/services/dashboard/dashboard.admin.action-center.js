/**
 * @file dashboard.admin.action-center.js
 * @description Admin action center + composite dashboard endpoints.
 *
 * Admin-scoped methods for the prioritized action center and the complete
 * admin dashboard composite. Exported as a plain object that the facade mixes
 * onto its prototype, so `this._getCoursesWithoutModules`, etc. and the admin
 * endpoint methods resolve at runtime.
 */

import { User, Course, COURSE_STATUS, constants } from "./dashboard.constants.js";

const adminActionCenter = {
  /* ------------------------------------------------------------------------ */
  /*                             Action Center                                */
  /* ------------------------------------------------------------------------ */

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

    // `PRIORITY_ORDER` is a static on the base service class; resolve through
    // the instance's constructor so it works regardless of the class name.
    const { PRIORITY_ORDER } = this.constructor;

    actions.sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    );

    return actions;
  },

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
  },
};

export default adminActionCenter;
