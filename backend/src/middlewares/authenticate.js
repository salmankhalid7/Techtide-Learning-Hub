/**
 * Authenticate Middleware
 *
 * 1. Read accessToken cookie
 * 2. Verify JWT
 * 3. Find user from database
 * 4. Attach user to req.user
 * 5. Continue request
 */

import User from "../models/user.model.js";
import { UnauthorizedError } from "../errors/index.js";
import { verifyAccessToken } from "../utils/auth/index.js";

const authenticate = async (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return next(new UnauthorizedError("Authentication required."));
  }

  let decoded;

  try {
    decoded = verifyAccessToken(token);
  } catch {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return next(new UnauthorizedError("Invalid or expired authentication token."));
  }

  const user = await User.findById(decoded.id).select("-password");

  if (!user) {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return next(new UnauthorizedError("User no longer exists."));
  }

  req.user = user;

  next();
};

export default authenticate;
