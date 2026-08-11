/**
 * @file ownership.helper.js
 * @description Reusable ownership verification helpers.
 *
 * Extracts the repeated pattern of:
 *   1. Find a Course by ID
 *   2. Check if user is the instructor or an admin
 *
 * Used by Module and Lesson services (and any future feature
 * that operates under a Course's ownership scope).
 */

import Course from "../models/course.model.js";
import { NotFoundError, ForbiddenError } from "../errors/index.js";

/**
 * Verifies that a course exists and that the current user
 * is either the course instructor or an admin.
 *
 * Only the ownership-relevant fields (`_id`, `instructor`) are fetched, so
 * callers don't hydrate the full Course document when only authorization is
 * needed.
 *
 * @param   {string}          courseId   - The course _id to verify.
 * @param   {object}          user       - The authenticated user (`req.user`).
 * @param   {string}          [action]   - Verb phrase for the forbidden message,
 *                                         e.g. "create modules in this course".
 *                                         Defaults to a generic action.
 * @returns {Promise<object>} The found Course document (lean-ish projection).
 * @throws  {NotFoundError}   If the course does not exist.
 * @throws  {ForbiddenError}  If the user is not the instructor or admin.
 */
export const verifyCourseOwnership = async (courseId, user, action = "perform this action on this course") => {
    const course = await Course.findById(courseId).select("_id instructor");

    if (!course) {
        throw new NotFoundError("Course not found");
    }

    if (
        user.role !== "admin" &&
        course.instructor.toString() !== user._id.toString()
    ) {
        throw new ForbiddenError(
            `You are not authorized to ${action}`
        );
    }

    return course;
};
