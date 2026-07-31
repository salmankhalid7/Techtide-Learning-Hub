/**
 * @file question.controller.js
 * @description Controller for Question Management APIs.
 *
 * Thin layer — no business logic, no database queries, no validation.
 * Delegates everything to question.service.js.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import {
  createQuestion as createQuestionService,
  getQuestion as getQuestionService,
  getQuizQuestions as getQuizQuestionsService,
  updateQuestion as updateQuestionService,
  deleteQuestion as deleteQuestionService,
  reorderQuestions as reorderQuestionsService,
} from "../services/question.service.js";

/**
 * @desc Create a new question within a quiz
 * @route POST /api/v1/quizzes/:quizId/questions
 * @access Private (Instructor/Admin)
 */
const createQuestion = asyncHandler(async (req, res) => {
  const question = await createQuestionService({
    quizId: req.params.quizId,
    user: req.user,
    data: req.body,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, "Question created successfully.", question));
});

/**
 * @desc Get a single question by ID
 * @route GET /api/v1/questions/:questionId
 * @access Private (Instructor/Admin)
 */
const getQuestion = asyncHandler(async (req, res) => {
  const question = await getQuestionService({
    questionId: req.params.questionId,
    user: req.user,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Question fetched successfully.", question));
});

/**
 * @desc Get paginated questions for a quiz
 * @route GET /api/v1/quizzes/:quizId/questions
 * @access Private (Instructor/Admin)
 */
const getQuizQuestions = asyncHandler(async (req, res) => {
  const result = await getQuizQuestionsService({
    quizId: req.params.quizId,
    user: req.user,
    query: req.query,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Questions fetched successfully.", result));
});

/**
 * @desc Update a question
 * @route PATCH /api/v1/questions/:questionId
 * @access Private (Instructor/Admin)
 */
const updateQuestion = asyncHandler(async (req, res) => {
  const question = await updateQuestionService({
    questionId: req.params.questionId,
    user: req.user,
    data: req.body,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Question updated successfully.", question));
});

/**
 * @desc Soft delete a question
 * @route DELETE /api/v1/questions/:questionId
 * @access Private (Instructor/Admin)
 */
const deleteQuestion = asyncHandler(async (req, res) => {
  await deleteQuestionService({
    questionId: req.params.questionId,
    user: req.user,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Question deleted successfully."));
});

/**
 * @desc Reorder questions within a quiz
 * @route PATCH /api/v1/quizzes/:quizId/questions/reorder
 * @access Private (Instructor/Admin)
 */
const reorderQuestions = asyncHandler(async (req, res) => {
  const questions = await reorderQuestionsService({
    quizId: req.params.quizId,
    user: req.user,
    questions: req.body.questions,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, "Questions reordered successfully.", questions));
});

export {
  createQuestion,
  getQuestion,
  getQuizQuestions,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
};
