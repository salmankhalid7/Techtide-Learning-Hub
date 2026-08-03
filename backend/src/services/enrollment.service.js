/**
 * @file enrollment.service.js
 * @description Enrollment business logic — enroll, retrieve, drop.
 */

import mongoose from "mongoose";

import Course from "../models/course.model.js";
import Enrollment from "../models/enrollment.model.js";
import Progress from "../models/progress.model.js";

import logger from "../config/logger.js";

import { COURSE_STATUS } from "../constants/course.constants.js";
import { ENROLLMENT_STATUS } from "../constants/enrollment.constants.js";
import { getPagination, getPaginationMeta } from "../utils/pagination.js";

import {
    BadRequestError,
    ConflictError,
    NotFoundError,
} from "../errors/index.js";

// ── Private helpers ────────────────────────────────────────────────────────

/** Fetch a course by ID within a transaction session. */
async function _getAvailableCourse(courseId, session) {
    const course = await Course.findById(courseId)
        .session(session)
        .lean();

    if (!course) {
        throw new NotFoundError("Course not found.");
    }

    return course;
}

/** Ensure the course is not deleted and is published. */
function _assertEnrollmentAllowed(course) {
    if (course.isDeleted) {
        throw new NotFoundError("Course not found.");
    }

    if (course.status !== COURSE_STATUS.PUBLISHED) {
        throw new BadRequestError(
            "Course is not available for enrollment."
        );
    }
}

/** Create an Enrollment doc inside a transaction. */
async function _createEnrollment(data, session) {
    const [enrollment] = await Enrollment.create(
        [data],
        { session }
    );

    return enrollment;
}

/** Create the initial Progress doc for a new enrollment. */
async function _createProgress(enrollment, session) {
    const [progress] = await Progress.create(
        [
            {
                enrollment: enrollment._id,
                student: enrollment.student,
                course: enrollment.course,
            },
        ],
        { session }
    );

    return progress;
}

/** Increment the course's denormalized enrollment counter. */
async function _incrementCourseEnrollmentCount(courseId, session) {
    await Course.updateOne(
        { _id: courseId },
        { $inc: { "statistics.totalEnrollments": 1 } },
        { session }
    );
}

/**
 * Decrement the course's denormalized enrollment counter.
 * Uses `$max` to floor at 0 — never goes negative.
 */
async function _decrementCourseEnrollmentCount(courseId, session) {
    await Course.updateOne(
        { _id: courseId },
        [
            {
                $set: {
                    "statistics.totalEnrollments": {
                        $max: [
                            { $subtract: ["$statistics.totalEnrollments", 1] },
                            0,
                        ],
                    },
                },
            },
        ],
        { session, updatePipeline: true }
    );
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Enroll a student into a published course.
 * Course must exist, be published, and not deleted.
 * Student cannot already have an ACTIVE enrollment.
 * Enrollment + Progress + counter increment are atomic.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.courseId
 * @param {mongoose.Types.ObjectId|string} params.studentId
 * @returns {Promise<Object>} {{ enrollment, progress }}
 * @throws {NotFoundError|ConflictError|BadRequestError}
 */
export async function enrollStudent({ courseId, studentId }) {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const course = await _getAvailableCourse(courseId, session);
        _assertEnrollmentAllowed(course);

        const existingEnrollment = await Enrollment.findOne({
            student: studentId,
            course: courseId,
            status: ENROLLMENT_STATUS.ACTIVE,
        })
            .session(session)
            .lean();

        if (existingEnrollment) {
            throw new ConflictError(
                "You are already enrolled in this course."
            );
        }

        const enrollment = await _createEnrollment(
            { student: studentId, course: courseId },
            session
        );

        const progress = await _createProgress(enrollment, session);

        await _incrementCourseEnrollmentCount(courseId, session);

        await session.commitTransaction();

        logger.info("Student enrolled successfully.", {
            enrollmentId: enrollment._id,
            studentId,
            courseId,
        });

        return { enrollment, progress };
    } catch (error) {
        await session.abortTransaction();

        logger.error("Enrollment failed.", {
            studentId,
            courseId,
            error: error.message,
        });

        throw error;
    } finally {
        await session.endSession();
    }
}

/**
 * Get the authenticated student's enrollment for a course.
 * Excludes dropped enrollments.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.courseId
 * @param {mongoose.Types.ObjectId|string} params.studentId
 * @returns {Promise<Enrollment>}
 * @throws {NotFoundError}
 */
export async function getEnrollment({ courseId, studentId }) {
    const enrollment = await Enrollment.findOne({
        student: studentId,
        course: courseId,
        status: { $ne: ENROLLMENT_STATUS.DROPPED },
    })
        .populate({
            path: "course",
            select: "title slug thumbnail status instructor statistics",
        })
        .lean();

    if (!enrollment) {
        throw new NotFoundError("Enrollment not found.");
    }

    return enrollment;
}

/**
 * List the authenticated student's enrollments with pagination.
 * Excludes dropped enrollments.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.studentId
 * @param {number} [params.page=1]
 * @param {number} [params.limit=10]
 * @returns {Promise<Object>} {{ enrollments, pagination }}
 */
export async function getMyEnrollments({
    studentId,
    page = 1,
    limit = 10,
}) {
    const { skip } = getPagination({ page, limit });

    const filter = {
        student: studentId,
        status: { $ne: ENROLLMENT_STATUS.DROPPED },
    };

    const [enrollments, total] = await Promise.all([
        Enrollment.find(filter)
            .populate({
                path: "course",
                select: "title slug thumbnail shortDescription status statistics.totalLessons statistics.totalDuration",
            })
            .sort({ enrolledAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),

        Enrollment.countDocuments(filter),
    ]);

    return {
        enrollments,
        pagination: getPaginationMeta(total, page, limit),
    };
}

/**
 * Drop a student's enrollment.
 * Sets status → DROPPED, records timestamp, decrements course counter.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.enrollmentId
 * @param {mongoose.Types.ObjectId|string} params.studentId
 * @returns {Promise<Enrollment>}
 * @throws {NotFoundError|BadRequestError}
 */
export async function dropEnrollment({
    enrollmentId,
    studentId,
}) {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const enrollment = await Enrollment.findOne({
            _id: enrollmentId,
            student: studentId,
        }).session(session);

        if (!enrollment) {
            throw new NotFoundError("Enrollment not found.");
        }

        if (enrollment.status === ENROLLMENT_STATUS.DROPPED) {
            throw new BadRequestError(
                "Enrollment has already been dropped."
            );
        }

        enrollment.status = ENROLLMENT_STATUS.DROPPED;
        enrollment.droppedAt = new Date();
        await enrollment.save({ session });

        // Remove the associated progress doc so the student can re-enroll.
        // Progress has a unique { student, course } index that would
        // otherwise block a fresh enrollment in the same course.
        await Progress.deleteOne({ enrollment: enrollment._id }).session(session);

        await _decrementCourseEnrollmentCount(enrollment.course, session);

        await session.commitTransaction();

        logger.info("Enrollment dropped successfully.", {
            enrollmentId,
            studentId,
        });

        return enrollment;
    } catch (error) {
        await session.abortTransaction();

        logger.error("Failed to drop enrollment.", {
            enrollmentId,
            studentId,
            error: error.message,
        });

        throw error;
    } finally {
        await session.endSession();
    }
}