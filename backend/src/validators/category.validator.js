/**
 * @file category.validator.js
 * @description Validation rules for Category APIs.
 */

import { body } from "express-validator";
import { objectIdRule } from "./rules/objectId.rule.js";

/**
 * Validation chain for creating a category (admin only).
 */
export const validateCreateCategory = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Category name is required.")
    .bail()
    .isLength({ min: 2, max: 80 })
    .withMessage("Category name must be between 2 and 80 characters."),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Category description cannot exceed 300 characters."),

  body("icon")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Category icon reference cannot exceed 200 characters."),
];

/**
 * Validation chain for updating a category (all fields optional, admin only).
 */
export const validateUpdateCategory = [
  objectIdRule("categoryId"),

  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Category name cannot be empty.")
    .bail()
    .isLength({ min: 2, max: 80 })
    .withMessage("Category name must be between 2 and 80 characters."),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage("Category description cannot exceed 300 characters."),

  body("icon")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Category icon reference cannot exceed 200 characters."),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean value."),
];

/**
 * Validates the categoryId route param.
 */
export const validateCategoryId = [objectIdRule("categoryId")];
