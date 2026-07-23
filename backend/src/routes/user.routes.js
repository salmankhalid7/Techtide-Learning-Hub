import { Router } from "express";
import { imageUpload } from "../middlewares/upload.middleware.js";
import userController from "../controllers/user.controller.js";
import authenticate from "../middlewares/authenticate.js";
import validate from "../middlewares/validation.middleware.js";

import {
  updateProfileValidator,
  changePasswordValidator,
} from "../validators/user.validator.js";

const router = Router();

/**
 * Get authenticated user's profile.
 */
router.get(
  "/profile",
  authenticate,
  userController.getProfile
);

/**
 * Update authenticated user's profile.
 */
router.patch(
  "/profile",
  authenticate,
  updateProfileValidator,
  validate,
  userController.updateProfile
);

/**
 * Change authenticated user's password.
 */
router.patch(
  "/change-password",
  authenticate,
  changePasswordValidator,
  validate,
  userController.changePassword
);
/**
 * Update authenticated user's avatar.
 */
router.patch(
  "/avatar",
  authenticate,
  imageUpload.single("avatar"),
  userController.updateAvatar
);

export default router;