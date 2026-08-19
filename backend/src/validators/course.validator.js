import { param, query } from "express-validator";
import mongoose from "mongoose";

import { COURSE_SORT_FIELDS, COURSE_LEVELS } from "../constants/course.constants.js";
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
    .isIn(COURSE_SORT_FIELDS)
    .withMessage(
      `SortBy must be one of: ${COURSE_SORT_FIELDS.join(", ")}.`
    ),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("SortOrder must be 'asc' or 'desc'."),

  query("search")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Search must be a string (max 200 chars)."),

  query("category")
    .optional()
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage("Invalid category."),

  query("level")
    .optional()
    .isIn(Object.values(COURSE_LEVELS))
    .withMessage("Invalid level."),

  // ── Advanced discovery filters (roadmap #8) ────────────

  query("minPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("minPrice must be a non-negative number."),

  query("maxPrice")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("maxPrice must be a non-negative number."),

  query("free")
    .optional()
    .isIn(["true", "false"])
    .withMessage("free must be 'true' or 'false'."),

  query("minRating")
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage("minRating must be between 0 and 5."),

  query("maxRating")
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage("maxRating must be between 0 and 5."),

  query("featured")
    .optional()
    .isIn(["true", "false"])
    .withMessage("featured must be 'true' or 'false'."),

  query("tags")
    .optional()
    .custom((v) => {
      const arr = Array.isArray(v) ? v : [v];
      return arr.every((t) => mongoose.Types.ObjectId.isValid(t));
    })
    .withMessage("tags must be valid ObjectIds (comma-separated or repeated)."),
];

/**
 * Validates query params for the discovery rails
 * (/courses/featured|popular|trending|recommended).
 */
export const validateDiscoveryRail = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50."),
  query("days")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Days must be between 1 and 365."),
];
