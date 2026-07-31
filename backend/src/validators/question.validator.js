/**
 * @file question.validator.js
 * @description Validation rules for Question APIs.
 *
 * Only validates request shape — complex business rules
 * (option counts, matching pairs, MCQ rules, ordering sequence, etc.)
 * are enforced in question.service.js.
 */

import { body, param, query } from "express-validator";

import {
  QUESTION_TYPES,
  DIFFICULTY_LEVELS,
  QUESTION_LIMITS,
} from "../constants/question.constants.js";
import validate from "../middlewares/validation.middleware.js";

/* -------------------------------------------------------------------------- */
/*                              Shared Helpers                                */
/* -------------------------------------------------------------------------- */

/**
 * Validates that a route param is a valid MongoDB ObjectId.
 *
 * @param {string} field
 * @returns {import("express-validator").ValidationChain}
 */
const mongoIdParam = (field) =>
  param(field)
    .isMongoId()
    .bail()
    .withMessage(`${field} must be a valid MongoDB ObjectId.`);

/* -------------------------------------------------------------------------- */
/*                           Create Question                                  */
/* -------------------------------------------------------------------------- */

export const createQuestionValidator = [
  param("quizId")
    .isMongoId()
    .bail()
    .withMessage("Invalid quiz ID."),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required.")
    .bail()
    .isLength({ max: 500 })
    .withMessage("Title cannot exceed 500 characters."),

  body("questionText")
    .trim()
    .notEmpty()
    .withMessage("Question text is required."),

  body("type")
    .notEmpty()
    .withMessage("Question type is required.")
    .bail()
    .isIn(Object.values(QUESTION_TYPES))
    .withMessage(
      `Type must be one of: ${Object.values(QUESTION_TYPES).join(", ")}.`
    ),

  body("options")
    .optional()
    .isArray({ max: QUESTION_LIMITS.MAX_OPTIONS })
    .withMessage(
      `Options must be an array with at most ${QUESTION_LIMITS.MAX_OPTIONS} items.`
    ),

  body("correctAnswers")
    .optional()
    .isArray()
    .withMessage("Correct answers must be an array."),

  body("marks")
    .notEmpty()
    .withMessage("Marks are required.")
    .bail()
    .isFloat({ min: 0.1 })
    .withMessage("Marks must be at least 0.1."),

  body("negativeMarks")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Negative marks cannot be negative."),

  body("difficulty")
    .optional()
    .isIn(Object.values(DIFFICULTY_LEVELS))
    .withMessage(
      `Difficulty must be one of: ${Object.values(DIFFICULTY_LEVELS).join(", ")}.`
    ),

  body("estimatedTime")
    .optional()
    .isInt({ min: QUESTION_LIMITS.MIN_ESTIMATED_TIME, max: QUESTION_LIMITS.MAX_ESTIMATED_TIME })
    .withMessage(
      `Estimated time must be between ${QUESTION_LIMITS.MIN_ESTIMATED_TIME} and ${QUESTION_LIMITS.MAX_ESTIMATED_TIME} seconds.`
    ),

  body("tags")
    .optional()
    .isArray({ max: QUESTION_LIMITS.MAX_TAGS })
    .withMessage(`Tags must be an array with at most ${QUESTION_LIMITS.MAX_TAGS} items.`),

  body("images")
    .optional()
    .isArray({ max: QUESTION_LIMITS.MAX_IMAGES })
    .withMessage(`Images must be an array with at most ${QUESTION_LIMITS.MAX_IMAGES} items.`),

  body("attachments")
    .optional()
    .isArray({ max: QUESTION_LIMITS.MAX_ATTACHMENTS })
    .withMessage(
      `Attachments must be an array with at most ${QUESTION_LIMITS.MAX_ATTACHMENTS} items.`
    ),

  body("externalResources")
    .optional()
    .isArray()
    .withMessage("External resources must be an array."),

  body("codeSnippet")
    .optional()
    .isObject()
    .withMessage("Code snippet must be an object."),

  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object."),

  validate,
];

/* -------------------------------------------------------------------------- */
/*                           Update Question                                  */
/* -------------------------------------------------------------------------- */

/**
 * Same shape as create but every field is optional.
 * Prevents mutation of service-controlled fields.
 */
export const updateQuestionValidator = [
  mongoIdParam("questionId"),

  body("title")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Title cannot exceed 500 characters."),

  body("questionText")
    .optional()
    .trim(),

  body("type")
    .optional()
    .isIn(Object.values(QUESTION_TYPES))
    .withMessage(
      `Type must be one of: ${Object.values(QUESTION_TYPES).join(", ")}.`
    ),

  body("options")
    .optional()
    .isArray({ max: QUESTION_LIMITS.MAX_OPTIONS })
    .withMessage(
      `Options must be an array with at most ${QUESTION_LIMITS.MAX_OPTIONS} items.`
    ),

  body("correctAnswers")
    .optional()
    .isArray()
    .withMessage("Correct answers must be an array."),

  body("marks")
    .optional()
    .isFloat({ min: 0.1 })
    .withMessage("Marks must be at least 0.1."),

  body("negativeMarks")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Negative marks cannot be negative."),

  body("difficulty")
    .optional()
    .isIn(Object.values(DIFFICULTY_LEVELS))
    .withMessage(
      `Difficulty must be one of: ${Object.values(DIFFICULTY_LEVELS).join(", ")}.`
    ),

  body("estimatedTime")
    .optional()
    .isInt({ min: QUESTION_LIMITS.MIN_ESTIMATED_TIME, max: QUESTION_LIMITS.MAX_ESTIMATED_TIME })
    .withMessage(
      `Estimated time must be between ${QUESTION_LIMITS.MIN_ESTIMATED_TIME} and ${QUESTION_LIMITS.MAX_ESTIMATED_TIME} seconds.`
    ),

  body("tags")
    .optional()
    .isArray({ max: QUESTION_LIMITS.MAX_TAGS })
    .withMessage(`Tags must be an array with at most ${QUESTION_LIMITS.MAX_TAGS} items.`),

  body("images")
    .optional()
    .isArray({ max: QUESTION_LIMITS.MAX_IMAGES })
    .withMessage(`Images must be an array with at most ${QUESTION_LIMITS.MAX_IMAGES} items.`),

  body("attachments")
    .optional()
    .isArray({ max: QUESTION_LIMITS.MAX_ATTACHMENTS })
    .withMessage(
      `Attachments must be an array with at most ${QUESTION_LIMITS.MAX_ATTACHMENTS} items.`
    ),

  body("externalResources")
    .optional()
    .isArray()
    .withMessage("External resources must be an array."),

  body("codeSnippet")
    .optional()
    .isObject()
    .withMessage("Code snippet must be an object."),

  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object."),

  // ── Guarded fields (never updated via API) ──

  body("quiz")
    .not()
    .exists()
    .withMessage("Quiz cannot be changed after creation."),

  body("order")
    .not()
    .exists()
    .withMessage("Order is managed by the reorder endpoint."),

  body("createdBy")
    .not()
    .exists()
    .withMessage("CreatedBy is a system-managed field."),

  body("deletedAt")
    .not()
    .exists()
    .withMessage("DeletedAt is a system-managed field."),

  body("publishedAt")
    .not()
    .exists()
    .withMessage("PublishedAt is a system-managed field."),

  body("archivedAt")
    .not()
    .exists()
    .withMessage("ArchivedAt is a system-managed field."),

  validate,
];

/* -------------------------------------------------------------------------- */
/*                           Get Single Question                              */
/* -------------------------------------------------------------------------- */

export const getQuestionValidator = [mongoIdParam("questionId"), validate];

/* -------------------------------------------------------------------------- */
/*                        Get Quiz Questions (List)                           */
/* -------------------------------------------------------------------------- */

export const getQuizQuestionsValidator = [
  mongoIdParam("quizId"),

  query("page")
    .optional()
    .toInt()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer."),

  query("limit")
    .optional()
    .toInt()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100."),

  query("search")
    .optional()
    .trim()
    .isString()
    .withMessage("Search must be a string."),

  query("difficulty")
    .optional()
    .isIn(Object.values(DIFFICULTY_LEVELS))
    .withMessage(
      `Difficulty must be one of: ${Object.values(DIFFICULTY_LEVELS).join(", ")}.`
    ),

  query("type")
    .optional()
    .isIn(Object.values(QUESTION_TYPES))
    .withMessage(
      `Type must be one of: ${Object.values(QUESTION_TYPES).join(", ")}.`
    ),

  query("sort")
    .optional()
    .trim()
    .isString()
    .withMessage("Sort must be a string."),

  validate,
];

/* -------------------------------------------------------------------------- */
/*                           Delete Question                                  */
/* -------------------------------------------------------------------------- */

export const deleteQuestionValidator = [mongoIdParam("questionId"), validate];

/* -------------------------------------------------------------------------- */
/*                          Reorder Questions                                 */
/* -------------------------------------------------------------------------- */

/**
 * Only validates the request shape.
 * Business checks (duplicates, missing questions, cross-quiz reorder, etc.)
 * are performed in the service layer.
 */
export const reorderQuestionsValidator = [
  mongoIdParam("quizId"),

  body("questions")
    .isArray({ min: 1 })
    .withMessage("Questions must be a non-empty array."),

  body("questions.*.questionId")
    .isMongoId()
    .withMessage("Each questionId must be a valid MongoDB ObjectId."),

  body("questions.*.order")
    .toInt()
    .isInt({ min: 1 })
    .withMessage("Each order must be a positive integer."),

  validate,
];
