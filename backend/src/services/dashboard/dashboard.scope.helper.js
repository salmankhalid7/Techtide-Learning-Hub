/**
 * @file dashboard.scope.helper.js
 * @description Instructor scope resolution helpers.
 *
 * Resolves the instructor's authored course/module IDs. These are mixed onto
 * the facade prototype by `dashboard.base.service.js`/facade composition, so
 * `this._getCourseScope` / `this._resolveScope` resolve at runtime.
 */

import mongoose from "mongoose";

import { Course, Module } from "./dashboard.constants.js";

const scopeHelpers = {
  /**
   * Resolve the instructor's course IDs and module IDs (non-deleted only).
   * @param {string|import("mongoose").Types.ObjectId} instructorId
   * @returns {Promise<import("./dashboard.constants.js").InstructorScope>}
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
  },

  /**
   * Resolve the instructor scope, honoring an already-resolved scope when the
   * caller (e.g. the composite `getDashboardStats`) passes one. This lets the
   * composite fetch the instructor's course/module IDs once and share them with
   * all its sub-queries instead of running an identical aggregation per query.
   * @param {string|import("mongoose").Types.ObjectId} instructorId
   * @param {import("./dashboard.constants.js").InstructorScope} [scope] Optional pre-resolved scope.
   * @returns {Promise<import("./dashboard.constants.js").InstructorScope>}
   */
  _resolveScope(instructorId, scope) {
    return scope ?? this._getCourseScope(instructorId);
  },
};

export default scopeHelpers;
