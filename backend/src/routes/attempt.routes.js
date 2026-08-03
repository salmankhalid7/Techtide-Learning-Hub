/**
 * @file attempt.routes.js
 * @description Routes for Quiz Attempts.
 */

import { Router } from "express";

import attemptController from "../controllers/attempt.controller.js";

import authenticate from "../middlewares/authenticate.js";
import validate from "../middlewares/validation.middleware.js";

import {
    startAttemptValidator,
    getAttemptValidator,
    saveAnswersValidator,
    submitAttemptValidator,
    attemptHistoryValidator,
} from "../validators/attempt.validator.js";

const router = Router();

// Student — start a new attempt
router.post(
    "/quizzes/:quizId/attempts",
    authenticate,
    startAttemptValidator,
    validate,
    attemptController.startAttempt
);

// Student / Instructor / Admin — view a single attempt
router.get(
    "/attempts/:attemptId",
    authenticate,
    getAttemptValidator,
    validate,
    attemptController.getAttempt
);

// Student — save answers during an attempt
router.patch(
    "/attempts/:attemptId/answers",
    authenticate,
    saveAnswersValidator,
    validate,
    attemptController.saveAnswers
);

// Student — submit an attempt for grading
router.post(
    "/attempts/:attemptId/submit",
    authenticate,
    submitAttemptValidator,
    validate,
    attemptController.submitAttempt
);

// Student / Instructor / Admin — view graded result
router.get(
    "/attempts/:attemptId/result",
    authenticate,
    getAttemptValidator,
    validate,
    attemptController.getResult
);

// Student / Instructor / Admin — attempt history for a quiz
router.get(
    "/quizzes/:quizId/attempts",
    authenticate,
    attemptHistoryValidator,
    validate,
    attemptController.getAttemptHistory
);

export default router;
