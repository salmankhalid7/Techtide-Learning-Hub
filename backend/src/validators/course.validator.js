import { param, query } from "express-validator";

import {
  courseTitleRule,
  shortDescriptionRule,
  descriptionRule,
  coursePriceRule,
  courseLanguageRule,
} from "./rules/course.rule.js";

/**
 * Validation chain for creating a course.
 */
export const validateCreateCourse = [
  ...courseTitleRule(),
  ...shortDescriptionRule(),
  ...descriptionRule(),
  ...coursePriceRule(),
  ...courseLanguageRule(),
];

/**
 * Validation chain for updating a course (all fields optional).
 */
export const validateUpdateCourse = [
  ...courseTitleRule().map((r) => r.optional()),
  ...shortDescriptionRule().map((r) => r.optional()),
  ...descriptionRule().map((r) => r.optional()),
  ...coursePriceRule().map((r) => r.optional()),
  ...courseLanguageRule(),
];

/**
 * Validates that the courseId route param is a valid MongoDB ObjectId.
 */
export const validateCourseId = [
  param("courseId")
    .isMongoId()
    .withMessage("Invalid course ID."),
];

/**
 * Validates optional query filters for listing courses.
 */
export const validateCourseFilters = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer."),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100."),

  query("sortBy")
    .optional()
    .isString()
    .withMessage("SortBy must be a string."),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("SortOrder must be 'asc' or 'desc'."),
];
