/**
 * @file attempt.controller.js
 * @description Quiz Attempt controllers.
 */

import attemptService from "../services/attempt.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import apiResponse from "../utils/apiResponse.js";
import { getPagination } from "../utils/pagination.js";

/**
 * @desc   Start a new quiz attempt
 * @route  POST /api/v1/quizzes/:quizId/attempts
 * @access Private (Student / Instructor / Admin)
 */
const startAttempt = asyncHandler(async (req, res) => {
    const attempt = await attemptService.startAttempt({
        quizId: req.params.quizId,
        user: req.user,
    });

    return apiResponse.success(res, {
        message: "Quiz attempt started successfully.",
        data: attempt,
        statusCode: 201,
    });
});

/**
 * @desc   Get a quiz attempt by ID
 * @route  GET /api/v1/attempts/:attemptId
 * @access Private (Student/Instructor/Admin)
 */
const getAttempt = asyncHandler(async (req, res) => {
    const attempt = await attemptService.getAttempt({
        attemptId: req.params.attemptId,
        userId: req.user.id,
        role: req.user.role,
    });

    return apiResponse.success(res, {
        message: "Quiz attempt retrieved successfully.",
        data: attempt,
    });
});

/**
 * @desc   Save answers for an in-progress attempt
 * @route  PATCH /api/v1/attempts/:attemptId/answers
 * @access Private (Student)
 */
const saveAnswers = asyncHandler(async (req, res) => {
    const attempt = await attemptService.saveAnswers({
        attemptId: req.params.attemptId,
        studentId: req.user.id,
        answers: req.body.answers,
    });

    return apiResponse.success(res, {
        message: "Answers saved successfully.",
        data: attempt,
    });
});

/**
 * @desc   Submit an attempt for grading
 * @route  POST /api/v1/attempts/:attemptId/submit
 * @access Private (Student)
 */
const submitAttempt = asyncHandler(async (req, res) => {
    const attempt = await attemptService.submitAttempt({
        attemptId: req.params.attemptId,
        studentId: req.user.id,
    });

    return apiResponse.success(res, {
        message: "Quiz submitted successfully.",
        data: attempt,
    });
});

/**
 * @desc   Get the result of a graded attempt
 * @route  GET /api/v1/attempts/:attemptId/result
 * @access Private (Student/Instructor/Admin)
 */
const getResult = asyncHandler(async (req, res) => {
    const result = await attemptService.getResult({
        attemptId: req.params.attemptId,
        userId: req.user.id,
        role: req.user.role,
    });

    return apiResponse.success(res, {
        message: "Quiz result retrieved successfully.",
        data: result,
    });
});

/**
 * @desc   Get paginated attempt history for a quiz
 * @route  GET /api/v1/quizzes/:quizId/attempts
 * @access Private (Student/Instructor/Admin)
 */
const getAttemptHistory = asyncHandler(async (req, res) => {
    const history = await attemptService.getAttemptHistory({
        quizId: req.params.quizId,
        userId: req.user.id,
        role: req.user.role,
        pagination: getPagination(req.query),
    });

    return apiResponse.success(res, {
        message: "Quiz attempt history retrieved successfully.",
        data: history,
    });
});

export default {
    startAttempt,
    getAttempt,
    saveAnswers,
    submitAttempt,
    getResult,
    getAttemptHistory,
};
