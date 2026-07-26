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
 * @param   {string}  courseId
 * @param   {object}  user   - The authenticated user (`req.user`).
 * @returns {Promise<object>} The found Course document.
 * @throws  {NotFoundError}   If the course does not exist.
 * @throws  {ForbiddenError}  If the user is not the instructor or admin.
 */
export const verifyCourseOwnership = async (courseId, user) => {
    const course = await Course.findById(courseId);

    if (!course) {
        throw new NotFoundError("Course not found");
    }

    if (
        user.role !== "admin" &&
        course.instructor.toString() !== user._id.toString()
    ) {
        throw new ForbiddenError(
            "You are not authorized to perform this action on this course"
        );
    }

    return course;
};
