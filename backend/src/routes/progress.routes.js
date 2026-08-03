/**
 * @file progress.routes.js
 * @description Routes for learning progress.
 */

import { Router } from "express";

import * as progressController from "../controllers/progress.controller.js";

import {
    updateLessonProgressValidator,
    getLessonProgressValidator,
    getModuleProgressValidator,
    getCourseProgressValidator,
    resumeLearningValidator,
} from "../validators/progress.validator.js";

import authenticate from "../middlewares/authenticate.js";

const router = Router();

/* -------------------------------------------------------------------------- */
/*                              Lesson Progress                               */
/* -------------------------------------------------------------------------- */

router.patch(
    "/lessons/:lessonId/progress",
    authenticate,
    updateLessonProgressValidator,
    progressController.updateLessonProgress
);

router.get(
    "/lessons/:lessonId/progress",
    authenticate,
    getLessonProgressValidator,
    progressController.getLessonProgress
);

/* -------------------------------------------------------------------------- */
/*                              Module Progress                               */
/* -------------------------------------------------------------------------- */

router.get(
    "/modules/:moduleId/progress",
    authenticate,
    getModuleProgressValidator,
    progressController.getModuleProgress
);

/* -------------------------------------------------------------------------- */
/*                              Course Progress                               */
/* -------------------------------------------------------------------------- */

router.get(
    "/courses/:courseId/progress",
    authenticate,
    getCourseProgressValidator,
    progressController.getCourseProgress
);

router.get(
    "/courses/:courseId/resume",
    authenticate,
    resumeLearningValidator,
    progressController.resumeLearning
);

export default router;