/**
 * @file quiz.controller.js
 * @description Controller for Quiz Management APIs.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as quizService from "../services/quiz.service.js";

/**
 * @desc Create a new quiz
 * @route POST /api/v1/modules/:moduleId/quizzes
 * @access Private (Instructor/Admin)
 */
const createQuiz = asyncHandler(async (req, res) => {
  const quiz = await quizService.createQuiz({
    moduleId: req.params.moduleId,
    user: req.user,
    data: req.body,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, "Quiz created successfully.", quiz));
});

/**
 * @desc Update quiz
 * @route PUT /api/v1/quizzes/:quizId
 * @access Private (Instructor/Admin)
 */
const updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await quizService.updateQuiz({
    quizId: req.params.quizId,
    user: req.user,
    data: req.body,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Quiz updated successfully.", quiz));
});

/**
 * @desc Get quiz by ID
 * @route GET /api/v1/quizzes/:quizId
 * @access Private (Instructor/Admin)
 */
const getQuiz = asyncHandler(async (req, res) => {
  const quiz = await quizService.getQuiz({
    quizId: req.params.quizId,
    user: req.user,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Quiz fetched successfully.", quiz));
});

/**
 * @desc Get quizzes by module
 * @route GET /api/v1/modules/:moduleId/quizzes
 * @access Private (Instructor/Admin)
 */
const getModuleQuizzes = asyncHandler(async (req, res) => {
  const quizzes = await quizService.getModuleQuizzes({
    moduleId: req.params.moduleId,
    user: req.user,
    query: req.query,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Quizzes fetched successfully.", quizzes));
});

/**
 * @desc Publish quiz
 * @route PATCH /api/v1/quizzes/:quizId/publish
 * @access Private (Instructor/Admin)
 */
const publishQuiz = asyncHandler(async (req, res) => {
  const quiz = await quizService.publishQuiz({
    quizId: req.params.quizId,
    user: req.user,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Quiz published successfully.", quiz));
});

/**
 * @desc Archive quiz
 * @route PATCH /api/v1/quizzes/:quizId/archive
 * @access Private (Instructor/Admin)
 */
const archiveQuiz = asyncHandler(async (req, res) => {
  const quiz = await quizService.archiveQuiz({
    quizId: req.params.quizId,
    user: req.user,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Quiz archived successfully.", quiz));
});

/**
 * @desc Soft delete quiz
 * @route DELETE /api/v1/quizzes/:quizId
 * @access Private (Instructor/Admin)
 */
const deleteQuiz = asyncHandler(async (req, res) => {
  await quizService.deleteQuiz({
    quizId: req.params.quizId,
    user: req.user,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Quiz deleted successfully."));
});

/**
 * @desc Reorder quizzes within a module
 * @route PUT /api/v1/modules/:moduleId/quizzes/reorder
 * @access Private (Instructor/Admin)
 */
const reorderQuizzes = asyncHandler(async (req, res) => {
  const quizzes = await quizService.reorderQuizzes({
    moduleId: req.params.moduleId,
    user: req.user,
    quizzes: req.body.quizzes,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Quizzes reordered successfully.", quizzes));
});

export { createQuiz, updateQuiz, getQuiz, getModuleQuizzes, publishQuiz, archiveQuiz, deleteQuiz, reorderQuizzes };