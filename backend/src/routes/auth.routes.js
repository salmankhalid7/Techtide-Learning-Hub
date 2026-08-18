import { Router } from "express";

import authController from "../controllers/auth.controller.js";
import {
  registerValidator,
  loginValidator,
  verifyEmailValidator,
  resendVerificationValidator,
  forgotPasswordValidator,
  resetPasswordRequestValidator,
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

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email using the token from the email link
 * @access  Public
 */
router.post(
  "/verify-email",
  verifyEmailValidator,
  validate,
  authController.verifyEmail
);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend the email verification link
 * @access  Public
 */
router.post(
  "/resend-verification",
  resendVerificationValidator,
  validate,
  authController.resendVerification
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send a password reset link
 * @access  Public
 */
router.post(
  "/forgot-password",
  forgotPasswordValidator,
  validate,
  authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset the password using the token from the reset link
 * @access  Public
 */
router.post(
  "/reset-password",
  resetPasswordRequestValidator,
  validate,
  authController.resetPassword
);

export default router;