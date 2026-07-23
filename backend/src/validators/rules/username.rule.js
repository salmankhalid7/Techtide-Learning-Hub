import { body } from "express-validator";
import { VALIDATION } from "../../constants/validation.constants.js";

/**
 * Reusable username validation rule.
 *
 * @param {string} field - The field name to validate (default: "username").
 * @returns {import("express-validator").ValidationChain[]}
 */
export const usernameRule = (field = "username") => [
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`${field} is required.`)
    .isLength({
      min: VALIDATION.NAME.MIN_LENGTH,
      max: 30,
    })
    .withMessage(`${field} must be between 3 and 30 characters.`)
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage(`${field} can only contain letters, numbers, and underscores.`)
    .isLowercase()
    .withMessage(`${field} must be lowercase.`),
];
