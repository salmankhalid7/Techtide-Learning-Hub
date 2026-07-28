import { body, param, query } from "express-validator";
import { QUIZ_STATUS } from "../models/quiz.model.js";
/**
 * Validate MongoDB ObjectId.
 *
 * @param {string} field
 * @returns {*}
 */
const validateObjectId = (field) =>
  param(field)
    .isMongoId()
    .bail()
    .withMessage(`${field} must be a valid MongoDB ObjectId.`);

/**
 * Validate ordering value.
 *
 * @param {string} field
 * @returns {*}
 */
const validateOrder = (field) =>
  body(field)
    .optional()
    .toInt()
    .isInt({ min: 1 })
    .withMessage(`${field} must be a positive integer.`);

/**
 * Pagination validators.
 */
const paginationValidators = [
  query("page")
    .optional()
    .toInt()
    .isInt({ min: 1 })
    .withMessage("Page must be greater than 0."),

  query("limit")
    .optional()
    .toInt()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100."),
];
/**
 * Validate quiz status.
 */
const validateQuizStatus = query("status")
  .optional()
  .isIn(QUIZ_STATUS)
  .withMessage("Invalid quiz status.");

/**
 * Validate request for creating a quiz.
 */
const createQuizValidator = [
  validateObjectId("moduleId"),

  body("title")
    .trim()
    .notEmpty()
    .withMessage("Quiz title is required.")
    .bail()
    .isLength({ min: 3, max: 200 })
    .withMessage("Quiz title must be between 3 and 200 characters."),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Description cannot exceed 5000 characters."),

  body("instructions")
    .optional()
    .trim()
    .isLength({ max: 3000 })
    .withMessage("Instructions cannot exceed 3000 characters."),

  validateOrder("order"),

  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object."),

  body("availability")
    .optional()
    .isObject()
    .withMessage("Availability must be an object."),
];

/**
 * Validate request for updating a quiz.
 */
const updateQuizValidator = [
  validateObjectId("quizId"),

  body("title")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Quiz title cannot be empty.")
    .bail()
    .isLength({ min: 3, max: 200 })
    .withMessage("Quiz title must be between 3 and 200 characters."),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Description cannot exceed 5000 characters."),

  body("instructions")
    .optional()
    .trim()
    .isLength({ max: 3000 })
    .withMessage("Instructions cannot exceed 3000 characters."),

  validateOrder("order"),

  body("settings")
    .optional()
    .isObject()
    .withMessage("Settings must be an object."),

  body("availability")
    .optional()
    .isObject()
    .withMessage("Availability must be an object."),
];

/**
 * Validate request for fetching a quiz.
 */
const getQuizValidator = [
  validateObjectId("quizId"),
];
/**
 * Validate request for fetching quizzes of a module.
 */
const getModuleQuizzesValidator = [
  validateObjectId("moduleId"),

  validateQuizStatus,

  ...paginationValidators,
];

/**
 * Validate request for publishing a quiz.
 */
const publishQuizValidator = [
  validateObjectId("quizId"),
];

/**
 * Validate request for archiving a quiz.
 */
const archiveQuizValidator = [
  validateObjectId("quizId"),
];

/**
 * Validate request for deleting a quiz.
 */
const deleteQuizValidator = [
  validateObjectId("quizId"),
];

/**
 * Validate request for reordering quizzes.
 */
const reorderQuizValidator = [
  validateObjectId("moduleId"),

  body("quizzes")
    .isArray({ min: 1 })
    .withMessage("Quizzes must be a non-empty array."),

  body("quizzes.*.quizId")
    .isMongoId()
    .bail()
    .withMessage("Each quizId must be a valid MongoDB ObjectId."),

  body("quizzes.*.order")
    .toInt()
    .isInt({ min: 1 })
    .withMessage("Each order must be a positive integer."),
];

export {
  createQuizValidator,
  updateQuizValidator,
  getQuizValidator,
  getModuleQuizzesValidator,
  publishQuizValidator,
  archiveQuizValidator,
  deleteQuizValidator,
  reorderQuizValidator,
};