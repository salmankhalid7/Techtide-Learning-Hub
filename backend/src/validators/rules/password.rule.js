import { body } from "express-validator";
import { VALIDATION } from "../../constants/validation.constants.js";

/**
 * Reusable password validation rule (length check only).
 *
 * @param {string} field - The field name to validate (default: "password").
 * @returns {import("express-validator").ValidationChain[]}
 */
export const passwordRule = (field = "password") => [
  body(field)
    .notEmpty()
    .withMessage(`${field} is required.`)
    .isLength({
      min: VALIDATION.PASSWORD.MIN_LENGTH,
      max: VALIDATION.PASSWORD.MAX_LENGTH,
    })
    .withMessage(
      `${field} must be between ${VALIDATION.PASSWORD.MIN_LENGTH} and ${VALIDATION.PASSWORD.MAX_LENGTH} characters.`
    ),
];