/**
 * @file lesson.validator.js
 * @description Validation rules for Lesson APIs.
 */

import { body, param } from "express-validator";

import { LESSON_TYPES, LESSON_STATUS } from "../constants/lesson.constants.js";
import { objectIdRule } from "./rules/objectId.rule.js";
import validate from "../middlewares/validation.middleware.js";

/*
|--------------------------------------------------------------------------
| Create Lesson
|--------------------------------------------------------------------------
*/

export const createLessonValidator = [
    objectIdRule("module"),

    body("title")
        .trim()
        .notEmpty()
        .withMessage("Lesson title is required.")
        .isLength({ max: 150 })
        .withMessage("Lesson title cannot exceed 150 characters."),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Description cannot exceed 2000 characters."),

    body("lessonType")
        .notEmpty()
        .withMessage("Lesson type is required.")
        .isIn(LESSON_TYPES)
        .withMessage("Invalid lesson type."),

    body("order")
        .isInt({ min: 1 })
        .withMessage("Order must be greater than zero."),

    body("duration")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Duration cannot be negative."),

    body("isPreview")
        .optional()
        .isBoolean(),

    body("isLocked")
        .optional()
        .isBoolean(),

    body("releaseAt")
        .optional()
        .isISO8601()
        .withMessage("Invalid release date."),

    validate
];

/*
|--------------------------------------------------------------------------
| Update Lesson
|--------------------------------------------------------------------------
*/

export const updateLessonValidator = [
    objectIdRule("lessonId"),

    body("title")
        .optional()
        .trim()
        .isLength({ max: 150 }),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 2000 }),

    body("lessonType")
        .optional()
        .isIn(LESSON_TYPES),

    body("duration")
        .optional()
        .isInt({ min: 0 }),

    body("isPreview")
        .optional()
        .isBoolean(),

    body("isLocked")
        .optional()
        .isBoolean(),

    body("releaseAt")
        .optional()
        .isISO8601(),

    validate
];

/*
|--------------------------------------------------------------------------
| Get Lesson
|--------------------------------------------------------------------------
*/

export const getLessonValidator = [
    objectIdRule("lessonId"),
    validate
];

/*
|--------------------------------------------------------------------------
| Delete Lesson
|--------------------------------------------------------------------------
*/

export const deleteLessonValidator = [
    objectIdRule("lessonId"),
    validate
];

/*
|--------------------------------------------------------------------------
| Publish Lesson
|--------------------------------------------------------------------------
*/

export const publishLessonValidator = [
    objectIdRule("lessonId"),

    body("status")
        .optional()
        .isIn(LESSON_STATUS),

    validate
];

/*
|--------------------------------------------------------------------------
| Archive Lesson
|--------------------------------------------------------------------------
*/

export const archiveLessonValidator = [
    objectIdRule("lessonId"),
    validate
];

/*
|--------------------------------------------------------------------------
| Get Lessons By Module
|--------------------------------------------------------------------------
*/

export const getLessonsByModuleValidator = [
    objectIdRule("moduleId"),
    validate
];

/*
|--------------------------------------------------------------------------
| Lesson ID
|--------------------------------------------------------------------------
*/

export const lessonIdValidator = [
    objectIdRule("lessonId"),
    validate
];

/*
|--------------------------------------------------------------------------
| Reorder Lessons
|--------------------------------------------------------------------------
*/

export const reorderLessonsValidator = [
    objectIdRule("module"),

    body("lessons")
        .isArray({ min: 1 })
        .withMessage("Lessons array is required."),

    body("lessons.*.lessonId")
        .isMongoId()
        .withMessage("Invalid lesson ID."),

    body("lessons.*.order")
        .isInt({ min: 1 })
        .withMessage("Order must be greater than zero."),

    validate
];