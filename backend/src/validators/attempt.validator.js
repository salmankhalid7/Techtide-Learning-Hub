/**
 * @file attempt.validator.js
 * @description Validation rules for Quiz Attempts.
 */

import { body, param } from "express-validator";
import { objectIdRule } from "./rules/objectId.rule.js";

export const startAttemptValidator = [
    param("quizId")
        .custom(objectIdRule)
        .withMessage("Invalid quiz ID."),
];

export const getAttemptValidator = [
    param("attemptId")
        .custom(objectIdRule)
        .withMessage("Invalid attempt ID."),
];

export const saveAnswersValidator = [
    param("attemptId")
        .custom(objectIdRule)
        .withMessage("Invalid attempt ID."),

    body("answers")
        .isArray({ min: 1 })
        .withMessage("Answers array is required."),

    body("answers.*.question")
        .custom(objectIdRule)
        .withMessage("Invalid question ID."),

    body("answers.*.selectedAnswers")
        .isArray()
        .withMessage("selectedAnswers must be an array."),

    body("answers.*.timeSpent")
        .optional()
        .isInt({ min: 0 })
        .withMessage("timeSpent must be a positive integer."),
];

export const submitAttemptValidator = [
    param("attemptId")
        .custom(objectIdRule)
        .withMessage("Invalid attempt ID."),
];

export const attemptHistoryValidator = [
    param("quizId")
        .custom(objectIdRule)
        .withMessage("Invalid quiz ID."),
];