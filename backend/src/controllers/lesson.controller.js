import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as lessonService from "../services/lesson.service.js";

/**
 * @desc    Create a new lesson
 * @route   POST /api/v1/lessons
 * @access  Private (Teacher/Admin)
 */
export const createLessonController = asyncHandler(async (req, res) => {
    const lesson = await lessonService.createLesson(req.body, req.user);

    return res
        .status(201)
        .json(new ApiResponse(201, lesson, "Lesson created successfully."));
});

/**
 * @desc    Get lesson by ID
 * @route   GET /api/v1/lessons/:lessonId
 * @access  Private
 */
export const getLessonByIdController = asyncHandler(async (req, res) => {
    const lesson = await lessonService.getLessonById(req.params.lessonId);

    return res
        .status(200)
        .json(new ApiResponse(200, lesson, "Lesson retrieved successfully."));
});

/**
 * @desc    Get all lessons for a module
 * @route   GET /api/v1/modules/:moduleId/lessons
 * @access  Private
 */
export const getLessonsByModuleController = asyncHandler(async (req, res) => {
    const lessons = await lessonService.getLessonsByModule(
        req.params.moduleId
    );

    return res
        .status(200)
        .json(
            new ApiResponse(200, lessons, "Lessons retrieved successfully.")
        );
});

/**
 * @desc    Update lesson
 * @route   PATCH /api/v1/lessons/:lessonId
 * @access  Private (Teacher/Admin)
 */
export const updateLessonController = asyncHandler(async (req, res) => {
    const lesson = await lessonService.updateLesson(
        req.params.lessonId,
        req.body,
        req.user
    );

    return res
        .status(200)
        .json(new ApiResponse(200, lesson, "Lesson updated successfully."));
});

/**
 * @desc    Publish lesson
 * @route   PATCH /api/v1/lessons/:lessonId/publish
 * @access  Private (Teacher/Admin)
 */
export const publishLessonController = asyncHandler(async (req, res) => {
    const lesson = await lessonService.publishLesson(
        req.params.lessonId,
        req.user
    );

    return res
        .status(200)
        .json(
            new ApiResponse(200, lesson, "Lesson published successfully.")
        );
});

/**
 * @desc    Archive lesson
 * @route   PATCH /api/v1/lessons/:lessonId/archive
 * @access  Private (Teacher/Admin)
 */
export const archiveLessonController = asyncHandler(async (req, res) => {
    const lesson = await lessonService.archiveLesson(
        req.params.lessonId,
        req.user
    );

    return res
        .status(200)
        .json(
            new ApiResponse(200, lesson, "Lesson archived successfully.")
        );
});

/**
 * @desc    Soft delete lesson
 * @route   DELETE /api/v1/lessons/:lessonId
 * @access  Private (Teacher/Admin)
 */
export const deleteLessonController = asyncHandler(async (req, res) => {
    await lessonService.deleteLesson(req.params.lessonId, req.user);

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Lesson deleted successfully."));
});

/**
 * @desc    Reorder lessons within a module
 * @route   PATCH /api/v1/modules/:moduleId/lessons/reorder
 * @access  Private (Teacher/Admin)
 */
export const reorderLessonsController = asyncHandler(async (req, res) => {
    const lessons = await lessonService.reorderLessons(
        req.params.moduleId,
        req.body.lessons,
        req.user
    );

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                lessons,
                "Lessons reordered successfully."
            )
        );
});
