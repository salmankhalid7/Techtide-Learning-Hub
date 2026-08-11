/**
 * @file courseStats.helper.js
 * @description Recomputes denormalised Course statistics after Module / Lesson
 * writes.
 *
 * The Course schema stores `statistics.totalModules`, `totalLessons`, and
 * `totalDuration` for fast reads (e.g. on `GET /enrollments/me`, which selects
 * `statistics.totalLessons` & `statistics.totalDuration`). Historically these
 * were never written, so students saw `0` lessons / `0` duration on their
 * enrollments.
 *
 * Like the quiz-statistics helper in `question.service.js`, we RECOMPUTE from
 * the source of truth (countDocuments / aggregate) and `$set` the result —
 * deliberately avoiding `$inc` so the values are self-healing if they ever
 * drift. These are idempotent and safe to call after any Module/Lesson write
 * that may change the counts.
 */

import mongoose from "mongoose";
import Course from "../models/course.model.js";
import Module from "../models/module.model.js";
import Lesson from "../models/lesson.model.js";

const { ObjectId } = mongoose.Types;

/**
 * Recompute a course's `statistics.totalModules`, `totalLessons`, and
 * `totalDuration` from its non-deleted modules and lessons.
 *
 * @param {string} courseId
 * @returns {Promise<void>}
 */
export const refreshCourseStats = async (courseId) => {
  const courseObjectId = new ObjectId(courseId);

  const moduleIds = await Module.find({
    course: courseObjectId,
    deletedAt: null,
  }).select("_id");

  const totalModules = moduleIds.length;
  const ids = moduleIds.map((m) => m._id);

  // No modules -> no lessons -> zero counts; short-circuit cleanly.
  if (ids.length === 0) {
    await Course.updateOne(
      { _id: courseObjectId },
      {
        $set: {
          "statistics.totalModules": 0,
          "statistics.totalLessons": 0,
          "statistics.totalDuration": 0,
        },
      }
    );
    return;
  }

  const [totalLessons, durationAgg] = await Promise.all([
    Lesson.countDocuments({ module: { $in: ids }, isDeleted: false }),
    Lesson.aggregate([
      {
        $match: {
          module: { $in: ids },
          isDeleted: false,
        },
      },
      { $group: { _id: null, totalDuration: { $sum: "$duration" } } },
    ]),
  ]);

  const totalDuration = durationAgg[0]?.totalDuration ?? 0;

  await Course.updateOne(
    { _id: courseObjectId },
    {
      $set: {
        "statistics.totalModules": totalModules,
        "statistics.totalLessons": totalLessons,
        "statistics.totalDuration": totalDuration,
      },
    }
  );
};
