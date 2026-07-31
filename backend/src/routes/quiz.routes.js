/**
 * @file quiz.routes.js
 * @description Routes for Quiz Management.
 */

import { Router } from "express";

import {
  createQuiz,
  getModuleQuizzes,
  getQuiz,
  updateQuiz,
  publishQuiz,
  archiveQuiz,
  deleteQuiz,
  reorderQuizzes,
} from "../controllers/quiz.controller.js";
import {
  createQuizValidator,
  updateQuizValidator,
  getQuizValidator,
  getModuleQuizzesValidator,
  publishQuizValidator,
  archiveQuizValidator,
  deleteQuizValidator,
  reorderQuizValidator,
} from "../validators/quiz.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

router.post(
  "/modules/:moduleId/quizzes",
  authenticate,
  authorize("instructor", "admin"),
  createQuizValidator,
  validate,
  createQuiz
);

router.get(
  "/modules/:moduleId/quizzes",
  authenticate,
  authorize("instructor", "admin"),
  getModuleQuizzesValidator,
  validate,
  getModuleQuizzes
);

router.get(
  "/quizzes/:quizId",
  authenticate,
  authorize("instructor", "admin"),
  getQuizValidator,
  validate,
  getQuiz
);

router.patch(
  "/quizzes/:quizId",
  authenticate,
  authorize("instructor", "admin"),
  updateQuizValidator,
  validate,
  updateQuiz
);

router.patch(
  "/quizzes/:quizId/publish",
  authenticate,
  authorize("instructor", "admin"),
  publishQuizValidator,
  validate,
  publishQuiz
);

router.patch(
  "/quizzes/:quizId/archive",
  authenticate,
  authorize("instructor", "admin"),
  archiveQuizValidator,
  validate,
  archiveQuiz
);

router.delete(
  "/quizzes/:quizId",
  authenticate,
  authorize("instructor", "admin"),
  deleteQuizValidator,
  validate,
  deleteQuiz
);

router.patch(
  "/modules/:moduleId/quizzes/reorder",
  authenticate,
  authorize("instructor", "admin"),
  reorderQuizValidator,
  validate,
  reorderQuizzes
);

export default router;