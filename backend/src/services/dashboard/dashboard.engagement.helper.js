/**
 * @file dashboard.engagement.helper.js
 * @description Student engagement + platform-issue-flagging helpers.
 *
 * Groups the enrollment-status aggregation, completion-rate aggregation, and
 * the platform-issue flagged-items builder. Mixed onto the facade prototype,
 * so `this._aggregateEnrollmentStatus()`, `this._aggregateCompletionRate()`,
 * and `this._buildFlaggedItems()` resolve at runtime.
 */

import { Enrollment, Progress, ENROLLMENT_STATUS } from "./dashboard.constants.js";

const engagementHelpers = {
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
  },

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
  },

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
  },
};

export default engagementHelpers;
