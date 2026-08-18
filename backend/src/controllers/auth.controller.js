import authService from "../services/auth.service.js";
import {
  setAuthCookies,
  clearAuthCookies,
} from "../utils/auth/index.js";

class AuthController {


  /**
 * Login user.
 */
async login(req, res, next) {
  try {
    const { email, password } = req.body;

    const {
      user,
      accessToken,
      refreshToken,
    } = await authService.login(email, password);

    setAuthCookies(
      res,
      accessToken,
      refreshToken
    );

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Login successful.",
      data: {
        user,
        // Exposed for API clients / tools that authenticate via a
        // `Authorization: Bearer <token>` header. Browsers still rely on the
        // httpOnly cookie set above (the token here is also readable by JS,
        // but the cookie remains the primary, XSS-safe path for web).
        accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
}
  /**
   * Logout user.
   */
  async logout(req, res, next) {
    try {
      await authService.logout(req.user.id);

      clearAuthCookies(res);

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "Logout successful.",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token.
   */
  async refreshToken(req, res, next) {
    try {
      const token =
        req.cookies.refreshToken;

      const result =
        await authService.refreshToken(
          token
        );

      setAuthCookies(
        res,
        result.accessToken,
        result.refreshToken
      );

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message:
          "Token refreshed successfully.",
      });
    } catch(error) {
      next(error);
    }
  }

  /**
   * Register a new user.
   */
  async register(req, res, next) {
    try {
      const {
        user,
        accessToken,
        refreshToken,
      } = await authService.register(req.body);

      setAuthCookies(
        res,
        accessToken,
        refreshToken
      );

      return res.status(201).json({
        success: true,
        statusCode: 201,
        message: "User registered successfully.",
        data: {
          user,
          accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify a user's email address (public — token from email link).
   */
  async verifyEmail(req, res, next) {
    try {
      const result = await authService.verifyEmail(req.query.token || req.params.token);
      return res.status(200).json({ success: true, statusCode: 200, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resend the email-verification link (public).
   */
  async resendVerification(req, res, next) {
    try {
      const result = await authService.sendVerificationEmail(req.body.email);
      return res.status(200).json({ success: true, statusCode: 200, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Request a password reset (public) — sends a reset link.
   */
  async forgotPassword(req, res, next) {
    try {
      const result = await authService.forgotPassword(req.body.email);
      return res.status(200).json({ success: true, statusCode: 200, ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reset a password using the token from the reset link (public).
   */
  async resetPassword(req, res, next) {
    try {
      const result = await authService.resetPassword(
        req.body.token,
        req.body.newPassword
      );
      return res.status(200).json({ success: true, statusCode: 200, ...result });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();