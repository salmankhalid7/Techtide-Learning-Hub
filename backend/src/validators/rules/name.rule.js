import { body } from "express-validator";
import { VALIDATION } from "../../constants/validation.constants.js";

/**
 * Reusable name validation rule.
 *
 * @param {string} field - The field name to validate (default: "fullName").
 * @returns {import("express-validator").ValidationChain[]}
 */
export const nameRule = (field = "fullName") => [
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`${field} is required.`)
    .isLength({
      min: VALIDATION.NAME.MIN_LENGTH,
      max: VALIDATION.NAME.MAX_LENGTH,
    })
    .withMessage(
      `${field} must be between ${VALIDATION.NAME.MIN_LENGTH} and ${VALIDATION.NAME.MAX_LENGTH} characters.`
    ),
];