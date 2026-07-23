import { Router } from "express";

import authController from "../controllers/auth.controller.js";
import {
  registerValidator,
  loginValidator,
} from "../validators/auth.validator.js";
import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  "/register",
  registerValidator,
  validate,
  authController.register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  "/login",
  loginValidator,
  validate,
  authController.login
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  "/logout",
  authenticate,
  authController.logout
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public (uses refreshToken cookie)
 */
router.post(
  "/refresh-token",
  authController.refreshToken
);

export default router;