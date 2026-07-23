import { body } from "express-validator";
import { VALIDATION } from "../../constants/validation.constants.js";

/**
 * Reusable email validation rule.
 *
 * @param {string} field - The field name to validate (default: "email").
 * @returns {import("express-validator").ValidationChain[]}
 */
export const emailRule = (field = "email") => [
  body(field)
    .trim()
    .notEmpty()
    .withMessage(`${field} is required.`)
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .isLength({
      max: VALIDATION.EMAIL.MAX_LENGTH,
    })
    .normalizeEmail(),
];