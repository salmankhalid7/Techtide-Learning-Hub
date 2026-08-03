/**
 * @file enrollment.controller.js
 * @description Controllers for Enrollment APIs.
 */

import httpStatus from "http-status";

import * as enrollmentService from "../services/enrollment.service.js";

/* -------------------------------------------------------------------------- */
/*                            Enroll Student                                  */
/* -------------------------------------------------------------------------- */

/**
 * Enroll the authenticated student in a course.
 *
 * POST /courses/:courseId/enroll
 */
export const enrollStudent = async (req, res, next) => {
    try {
        const enrollment = await enrollmentService.enrollStudent({
            courseId: req.params.courseId,
            studentId: req.user._id,
        });

        return res.status(httpStatus.CREATED).json({
            success: true,
            statusCode: httpStatus.CREATED,
            message: "Successfully enrolled in the course.",
            data: enrollment,
        });
    } catch (error) {
        next(error);
    }
};

/* -------------------------------------------------------------------------- */
/*                           Get Enrollment                                   */
/* -------------------------------------------------------------------------- */

/**
 * Get the authenticated student's enrollment for a course.
 *
 * GET /courses/:courseId/enrollment
 */
export const getEnrollment = async (req, res, next) => {
    try {
        const enrollment = await enrollmentService.getEnrollment({
            courseId: req.params.courseId,
            studentId: req.user._id,
        });

        return res.status(httpStatus.OK).json({
            success: true,
            statusCode: httpStatus.OK,
            message: "Enrollment retrieved successfully.",
            data: enrollment,
        });
    } catch (error) {
        next(error);
    }
};

/* -------------------------------------------------------------------------- */
/*                         Get My Enrollments                                 */
/* -------------------------------------------------------------------------- */

/**
 * Get all enrollments for the authenticated student.
 *
 * GET /enrollments
 */
export const getMyEnrollments = async (req, res, next) => {
    try {
        const enrollments = await enrollmentService.getMyEnrollments({
            studentId: req.user._id,
            page: req.query.page,
            limit: req.query.limit,
        });

        return res.status(httpStatus.OK).json({
            success: true,
            statusCode: httpStatus.OK,
            message: "Enrollments retrieved successfully.",
            data: enrollments,
        });
    } catch (error) {
        next(error);
    }
};

/* -------------------------------------------------------------------------- */
/*                            Drop Enrollment                                 */
/* -------------------------------------------------------------------------- */

/**
 * Drop an active enrollment.
 *
 * PATCH /enrollments/:enrollmentId/drop
 */
export const dropEnrollment = async (req, res, next) => {
    try {
        const enrollment = await enrollmentService.dropEnrollment({
            enrollmentId: req.params.enrollmentId,
            studentId: req.user._id,
        });

        return res.status(httpStatus.OK).json({
            success: true,
            statusCode: httpStatus.OK,
            message: "Enrollment dropped successfully.",
            data: enrollment,
        });
    } catch (error) {
        next(error);
    }
};