import { body } from "express-validator";
import { isStrongPassword } from "../custom/password.validator.js";

/**
 * Reusable password strength validation rule.
 * Should be paired with passwordRule() on the same field.
 *
 * @param {string} field - The field name to validate (default: "password").
 * @returns {import("express-validator").ValidationChain[]}
 */
export const passwordStrengthRule = (field = "password") => [
  body(field).custom((value) => {
    if (!isStrongPassword(value)) {
      throw new Error(
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character."
      );
    }

    return true;
  }),
];
