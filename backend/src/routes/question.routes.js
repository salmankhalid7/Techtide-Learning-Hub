/**
 * @file question.routes.js
 * @description Routes for Question Management.
 */

import { Router } from "express";

import {
  createQuestion,
  getQuestion,
  getQuizQuestions,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
} from "../controllers/question.controller.js";

import {
  createQuestionValidator,
  updateQuestionValidator,
  getQuestionValidator,
  getQuizQuestionsValidator,
  deleteQuestionValidator,
  reorderQuestionsValidator,
} from "../validators/question.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

/* -------------------------------------------------------------------------- */
/*                             Quiz Question Routes                           */
/* -------------------------------------------------------------------------- */

router.post(
  "/quizzes/:quizId/questions",
  authenticate,
  authorize("instructor", "admin"),
  createQuestionValidator,
  validate,
  createQuestion
);

router.get(
  "/quizzes/:quizId/questions",
  authenticate,
  authorize("instructor", "admin"),
  getQuizQuestionsValidator,
  validate,
  getQuizQuestions
);

router.patch(
  "/quizzes/:quizId/questions/reorder",
  authenticate,
  authorize("instructor", "admin"),
  reorderQuestionsValidator,
  validate,
  reorderQuestions
);

/* -------------------------------------------------------------------------- */
/*                           Individual Question Routes                       */
/* -------------------------------------------------------------------------- */

router.get(
  "/questions/:questionId",
  authenticate,
  authorize("instructor", "admin"),
  getQuestionValidator,
  validate,
  getQuestion
);

router.patch(
  "/questions/:questionId",
  authenticate,
  authorize("instructor", "admin"),
  updateQuestionValidator,
  validate,
  updateQuestion
);

router.delete(
  "/questions/:questionId",
  authenticate,
  authorize("instructor", "admin"),
  deleteQuestionValidator,
  validate,
  deleteQuestion
);

export default router;
