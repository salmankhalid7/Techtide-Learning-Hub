import userService from "../services/user.service.js";
import { clearAuthCookies } from "../utils/auth/index.js";
class UserController {
  /**
   * Get authenticated user's profile.
   */
  async getProfile(req, res, next) {
    try {
      const user = await userService.getProfile(req.user.id);

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "Profile fetched successfully.",
        data: user,
      });
    } catch (error) {
      next(error);
    }
  }
  /**
 * Update authenticated user's profile.
 */
  async updateProfile(req, res, next) {
    try {
      const updatedUser = await userService.updateProfile(
        req.user.id,
        req.body
      );

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message: "Profile updated successfully.",
        data: updatedUser,
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * Change authenticated user's password.
   */
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      await userService.changePassword(
        req.user.id,
        currentPassword,
        newPassword
      );

      clearAuthCookies(res);

      return res.status(200).json({
        success: true,
        statusCode: 200,
        message:
          "Password changed successfully. Please login again.",
      });
    } catch (error) {
      next(error);
    }
  }
  /**
 * Update authenticated user's avatar.
 */
async updateAvatar(req, res, next) {
  try {
    const updatedUser = await userService.updateAvatar(
      req.user.id,
      req.file
    );

    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: "Avatar updated successfully.",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}
}

export default new UserController();