import User from "../models/user.model.js";
import AppError from "../errors/AppError.js";
import RefreshToken from "../models/refreshToken.model.js";
import uploadImage from "../utils/cloudinary/uploadImage.js";
import deleteImage from "../utils/cloudinary/deleteImage.js";

class UserService {
  /**
   * Get user profile.
   */
  async getProfile(userId) {
    // `password` and `refreshToken` are already `select: false` on the schema,
    // so no explicit exclusion is needed, and `.lean()` returns a lightweight
    // plain object instead of a hydrated Mongoose document (read-only endpoint).
    const user = await User.findById(userId).lean();

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    return user;
  }

  /**
 * Update authenticated user's profile.
 */
  async updateProfile(userId, data) {
    const { fullName, username } = data;

    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });

      if (existingUser) {
        throw new AppError(
          "Username is already taken.",
          409
        );
      }

      user.username = username;
    }

    if (fullName) {
      user.fullName = fullName;
    }

    // `validateModifiedOnly` skips re-validating unchanged fields; the saved
    // document already reflects all changes, so `toJSON()` (schema hook) strips
    // password/refreshToken and avoids an extra `findById` round trip.
    await user.save({ validateModifiedOnly: true });

    return user.toJSON();
  }

  /**
   * Change authenticated user's password.
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select("+password");

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    const isPasswordValid = await user.comparePassword(
      currentPassword
    );

    if (!isPasswordValid) {
      throw new AppError(
        "Current password is incorrect.",
        400
      );
    }

    user.password = newPassword;

    await user.save();

    // Revoke all refresh tokens
    await RefreshToken.updateMany(
      { user: userId },
      { revoked: true }
    );
  }
  /**
   * Update authenticated user's avatar.
   *
   * @param {string} userId
   * @param {Express.Multer.File} file
   * @returns {Promise<Object>}
   */
  async updateAvatar(userId, file) {

    if (!file) {
      throw new AppError("Avatar image is required.", 400);
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    // Delete previous avatar from Cloudinary.
    if (user.avatar?.publicId) {
      await deleteImage(user.avatar.publicId);
    }

    // Upload new avatar.
    const uploadedImage = await uploadImage(
      file.buffer,
      "learnx-ai/avatars"
    );

    user.avatar = {
      url: uploadedImage.secure_url,
      publicId: uploadedImage.public_id,
    };

    // The saved document already holds the new avatar. `validateModifiedOnly`
    // skips re-validating unchanged fields; `toJSON()` (schema hook) strips
    // password/refreshToken/__v, avoiding an extra `findById` round trip.
    await user.save({ validateModifiedOnly: true });

    return user.toJSON();
  }
}

export default new UserService();