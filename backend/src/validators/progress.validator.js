/**
 * @file progress.validator.js
 * @description Validation rules for Learning Progress APIs.
 */

import { body } from "express-validator";

import validate from "../middlewares/validation.middleware.js";
import { objectIdRule } from "./rules/objectId.rule.js";

/* -------------------------------------------------------------------------- */
/*                       Update Lesson Progress                               */
/* -------------------------------------------------------------------------- */

export const updateLessonProgressValidator = [
    objectIdRule("lessonId"),

    body("isCompleted")
        .notEmpty()
        .withMessage("Completion status is required.")
        .isBoolean()
        .withMessage("Completion status must be true or false."),

    body("timeSpent")
        .optional()
        .isInt({ min: 0 })
        .withMessage("Time spent cannot be negative."),

    validate,
];

/* -------------------------------------------------------------------------- */
/*                         Get Lesson Progress                                */
/* -------------------------------------------------------------------------- */

export const getLessonProgressValidator = [
    objectIdRule("lessonId"),
    validate,
];

/* -------------------------------------------------------------------------- */
/*                         Get Module Progress                                */
/* -------------------------------------------------------------------------- */

export const getModuleProgressValidator = [
    objectIdRule("moduleId"),
    validate,
];

/* -------------------------------------------------------------------------- */
/*                         Get Course Progress                                */
/* -------------------------------------------------------------------------- */

export const getCourseProgressValidator = [
    objectIdRule("courseId"),
    validate,
];

/* -------------------------------------------------------------------------- */
/*                          Resume Learning                                   */
/* -------------------------------------------------------------------------- */

export const resumeLearningValidator = [
    objectIdRule("courseId"),
    validate,
];