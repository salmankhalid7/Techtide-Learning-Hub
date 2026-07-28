/**
 * @file quiz.routes.js
 * @description Routes for Quiz Management.
 */

import { Router } from "express";

import * as quizController from "../controllers/quiz.controller.js";
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
  quizController.createQuiz
);

router.get(
  "/modules/:moduleId/quizzes",
  authenticate,
  authorize("instructor", "admin"),
  getModuleQuizzesValidator,
  validate,
  quizController.getModuleQuizzes
);

router.get(
  "/quizzes/:quizId",
  authenticate,
  authorize("instructor", "admin"),
  getQuizValidator,
  validate,
  quizController.getQuiz
);

router.patch(
  "/quizzes/:quizId",
  authenticate,
  authorize("instructor", "admin"),
  updateQuizValidator,
  validate,
  quizController.updateQuiz
);

router.patch(
  "/quizzes/:quizId/publish",
  authenticate,
  authorize("instructor", "admin"),
  publishQuizValidator,
  validate,
  quizController.publishQuiz
);

router.patch(
  "/quizzes/:quizId/archive",
  authenticate,
  authorize("instructor", "admin"),
  archiveQuizValidator,
  validate,
  quizController.archiveQuiz
);

router.delete(
  "/quizzes/:quizId",
  authenticate,
  authorize("instructor", "admin"),
  deleteQuizValidator,
  validate,
  quizController.deleteQuiz
);

router.patch(
  "/modules/:moduleId/quizzes/reorder",
  authenticate,
  authorize("instructor", "admin"),
  reorderQuizValidator,
  validate,
  quizController.reorderQuizzes
);

export default router;