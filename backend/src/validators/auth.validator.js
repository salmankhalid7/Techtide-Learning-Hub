import { body } from "express-validator";

import { emailRule } from "./rules/email.rule.js";
import { passwordRule } from "./rules/password.rule.js";
import { nameRule } from "./rules/name.rule.js";
import { usernameRule } from "./rules/username.rule.js";
import { passwordStrengthRule } from "./rules/passwordStrength.rule.js";

/** Shared confirm-password check */
const confirmPasswordRule = () =>
  body("confirmPassword")
    .notEmpty()
    .withMessage("Confirm password is required.")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match.");
      }

      return true;
    });

/**
 * Validation rules for user registration.
 */
export const registerValidator = [
  nameRule(),
  usernameRule(),
  emailRule(),
  passwordRule(),
  passwordStrengthRule(),
  confirmPasswordRule(),

  body("role")
    .optional()
    .isIn(["student", "instructor"])
    .withMessage("Invalid role."),
];

/**
 * Validation rules for user login.
 */
export const loginValidator = [
  emailRule(),
  passwordRule(),
];

/**
 * Validation rules for requesting a password reset.
 */
export const forgotPasswordValidator = [
  emailRule(),
];

/**
 * Validation rules for resetting a password.
 */
export const resetPasswordValidator = [
  passwordRule(),
  passwordStrengthRule(),
  confirmPasswordRule(),
];