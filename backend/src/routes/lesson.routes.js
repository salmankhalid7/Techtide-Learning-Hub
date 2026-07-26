import { Router } from "express";

import {
    createLessonController,
    updateLessonController,
    getLessonByIdController,
    getLessonsByModuleController,
    publishLessonController,
    archiveLessonController,
    deleteLessonController,
    reorderLessonsController,
} from "../controllers/lesson.controller.js";

import {
    createLessonValidator,
    updateLessonValidator,
    getLessonValidator,
    getLessonsByModuleValidator,
    deleteLessonValidator,
    publishLessonValidator,
    archiveLessonValidator,
    reorderLessonsValidator,
} from "../validators/lesson.validator.js";

import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";


const router = Router();

/**
 * Read Access
 *
 * Routes accessible to authenticated users (students, teachers, admins).
 */
router.use(authenticate);

// Get Lesson By ID
router.get(
    "/:lessonId",
    ...getLessonValidator,
    getLessonByIdController
);


// Get Lessons By Module
router.get(
    "/module/:moduleId",
    ...getLessonsByModuleValidator,
    getLessonsByModuleController
);


/**
 * Teacher/Admin Lesson Management
 *
 * All routes below require teacher or admin role.
 */

// Reorder Lessons (must be before /:lessonId to avoid route conflict)
router.patch(
    "/module/:moduleId/reorder",
    authorize("instructor", "admin"),
    ...reorderLessonsValidator,
    reorderLessonsController
);


// Create Lesson
router.post(
    "/",
    authorize("instructor", "admin"),
    ...createLessonValidator,
    createLessonController
);


// Update Lesson
router.patch(
    "/:lessonId",
    authorize("instructor", "admin"),
    ...updateLessonValidator,
    updateLessonController
);


// Publish Lesson
router.patch(
    "/:lessonId/publish",
    authorize("instructor", "admin"),
    ...publishLessonValidator,
    publishLessonController
);


// Archive Lesson
router.patch(
    "/:lessonId/archive",
    authorize("instructor", "admin"),
    ...archiveLessonValidator,
    archiveLessonController
);


// Delete Lesson
router.delete(
    "/:lessonId",
    authorize("instructor", "admin"),
    ...deleteLessonValidator,
    deleteLessonController
);


export default router;