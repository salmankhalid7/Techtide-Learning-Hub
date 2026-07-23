import User from "../models/user.model.js";

import { NotFoundError, UnauthorizedError } from "../errors/index.js";

import RefreshToken from "../models/refreshToken.model.js";
import {
  generateAccessToken,
  generateRefreshToken,
} from "./token.service.js";
import jwt from "jsonwebtoken";
import AppError from "../errors/AppError.js";
class AuthService {
  /**
   * Register a new user.
   */
  async register(userData) {
    const {
      fullName,
      username,
      email,
      password,
      role,
    } = userData;

    // Check if email already exists
    const existingEmail = await User.findOne({ email });

    if (existingEmail) {
      throw new Error("Email is already registered.");
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });

    if (existingUsername) {
      throw new Error("Username is already taken.");
    }

    // Create user
    const user = await User.create({
      fullName,
      username,
      email,
      password,
      role,
    });

const accessToken = generateAccessToken(user._id);

const refreshToken = generateRefreshToken(user._id);

await RefreshToken.create({
  user: user._id,
  token: refreshToken,
  expiresAt: new Date(
    Date.now() +
    7 * 24 * 60 * 60 * 1000
  ),
});

return {
  user,
  accessToken,
  refreshToken,
};
  }

  /**
   * Refresh access token using a valid refresh token.
   */
  async refreshToken(token) {
    if (!token) {
      throw new AppError(
        "Refresh token required.",
        401
      );
    }

    const storedToken =
      await RefreshToken.findOne({
        token,
      });

    if (
      !storedToken ||
      storedToken.revoked
    ) {
      throw new AppError(
        "Refresh token has been revoked.",
        401
      );
    }

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_REFRESH_SECRET
      );
    } catch (error) {
      throw new AppError(
        "Refresh token expired or invalid.",
        401
      );
    }

    const userId = decoded.id;

    const user =
      await User.findById(userId);

    if (!user) {
      throw new AppError(
        "User no longer exists.",
        401
      );
    }

    // Revoke old token
    storedToken.revoked = true;

    await storedToken.save();

    const newAccessToken =
      generateAccessToken(userId);

    const newRefreshToken =
      generateRefreshToken(userId);

    await RefreshToken.create({
      user: userId,
      token: newRefreshToken,
      expiresAt:
        new Date(
          Date.now()
          +
          7 * 24 * 60 * 60 * 1000
        ),
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Logout a user by clearing their refresh token.
   */
  async logout(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError("User not found.");
    }

    await RefreshToken.updateMany(
      {
        user: userId,
      },
      {
        revoked: true,
      }
    );

    return true;
  }

  /**
   * Authenticate a user with email and password.
   */
  async login(email, password) {
    // Find user with password
    const user = await User.findOne({ email })
      .select("+password");

    if (!user) {
      throw new UnauthorizedError(
        "Invalid email or password."
      );
    }

    // Compare password
    const isPasswordValid =
      await user.comparePassword(password);

    if (!isPasswordValid) {
      throw new UnauthorizedError(
        "Invalid email or password."
      );
    }

    const accessToken = generateAccessToken(user._id);

    const refreshToken = generateRefreshToken(user._id);

    await RefreshToken.create({
      user: user._id,
      token: refreshToken,
      expiresAt: new Date(
        Date.now() +
        7 * 24 * 60 * 60 * 1000
      ),
    });

    return {
      user,
      accessToken,
      refreshToken,
    };
  }
}

export default new AuthService();