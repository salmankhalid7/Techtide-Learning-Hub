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
    .withMessage("Confirm password is1 required.")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match.");
      }

      return true;
    });

/** Confirm check comparing against a named password field. */
const confirmFieldRule = (passwordField) =>
  body("confirmPassword")
    .notEmpty()
    .withMessage("Confirm password is required.")
    .custom((value, { req }) => {
      if (value !== req.body[passwordField]) {
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

/**
 * Validation rules for verifying an email (token in query or param).
 */
export const verifyEmailValidator = [
  body("token").optional(),
];

/**
 * Validation rules for resending the verification email.
 */
export const resendVerificationValidator = [
  emailRule(),
];

/**
 * Validation rules for resetting a password via the auth service
 * (uses `newPassword` field alongside `token` + `confirmPassword`).
 */
export const resetPasswordRequestValidator = [
  body("token").notEmpty().withMessage("Token is required."),
  passwordRule("newPassword"),
  passwordStrengthRule("newPassword"),
  confirmFieldRule("newPassword"),
];