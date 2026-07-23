import { body } from "express-validator";

import { nameRule } from "./rules/name.rule.js";
import { usernameRule } from "./rules/username.rule.js";
import { passwordRule } from "./rules/password.rule.js";
import { passwordStrengthRule } from "./rules/passwordStrength.rule.js";

/**
 * Validation rules for updating the authenticated user's profile.
 */
export const updateProfileValidator = [
  ...nameRule(),
  ...usernameRule(),
];

/**
 * Validation rules for changing the authenticated user's password.
 */
export const changePasswordValidator = [
  ...passwordRule("currentPassword"),
  ...passwordRule("newPassword"),
  ...passwordStrengthRule("newPassword"),
];

export const updateAvatarValidator = [];