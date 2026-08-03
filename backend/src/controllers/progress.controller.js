/**
 * @file progress.controller.js
 * @description Controllers for Learning Progress APIs.
 */

import httpStatus from "http-status";

import * as progressService from "../services/progress.service.js";

/* -------------------------------------------------------------------------- */
/*                        Update Lesson Progress                              */
/* -------------------------------------------------------------------------- */

/**
 * Update lesson progress.
 *
 * PATCH /lessons/:lessonId/progress
 */
export const updateLessonProgress = async (req, res, next) => {
    try {
        const progress = await progressService.updateLessonProgress({
            lessonId: req.params.lessonId,
            studentId: req.user._id,
            completed: req.body.completed,
        });

        return res.status(httpStatus.OK).json({
            success: true,
            statusCode: httpStatus.OK,
            message: "Lesson progress updated successfully.",
            data: progress,
        });
    } catch (error) {
        next(error);
    }
};

/* -------------------------------------------------------------------------- */
/*                          Get Lesson Progress                               */
/* -------------------------------------------------------------------------- */

/**
 * GET /lessons/:lessonId/progress
 */
export const getLessonProgress = async (req, res, next) => {
    try {
        const progress = await progressService.getLessonProgress({
            lessonId: req.params.lessonId,
            studentId: req.user._id,
        });

        return res.status(httpStatus.OK).json({
            success: true,
            statusCode: httpStatus.OK,
            message: "Lesson progress retrieved successfully.",
            data: progress,
        });
    } catch (error) {
        next(error);
    }
};

/* -------------------------------------------------------------------------- */
/*                          Get Module Progress                               */
/* -------------------------------------------------------------------------- */

/**
 * GET /modules/:moduleId/progress
 */
export const getModuleProgress = async (req, res, next) => {
    try {
        const progress = await progressService.getModuleProgress({
            moduleId: req.params.moduleId,
            studentId: req.user._id,
        });

        return res.status(httpStatus.OK).json({
            success: true,
            statusCode: httpStatus.OK,
            message: "Module progress retrieved successfully.",
            data: progress,
        });
    } catch (error) {
        next(error);
    }
};

/* -------------------------------------------------------------------------- */
/*                          Get Course Progress                               */
/* -------------------------------------------------------------------------- */

/**
 * GET /courses/:courseId/progress
 */
export const getCourseProgress = async (req, res, next) => {
    try {
        const progress = await progressService.getCourseProgress({
            courseId: req.params.courseId,
            studentId: req.user._id,
        });

        return res.status(httpStatus.OK).json({
            success: true,
            statusCode: httpStatus.OK,
            message: "Course progress retrieved successfully.",
            data: progress,
        });
    } catch (error) {
        next(error);
    }
};

/* -------------------------------------------------------------------------- */
/*                            Resume Learning                                 */
/* -------------------------------------------------------------------------- */

/**
 * GET /courses/:courseId/resume
 */
export const resumeLearning = async (req, res, next) => {
    try {
        const progress = await progressService.resumeLearning({
            courseId: req.params.courseId,
            studentId: req.user._id,
        });

        return res.status(httpStatus.OK).json({
            success: true,
            statusCode: httpStatus.OK,
            message: "Resume learning retrieved successfully.",
            data: progress,
        });
    } catch (error) {
        next(error);
    }
};