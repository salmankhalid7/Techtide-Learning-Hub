/**
 * @file authenticateOptional.js
 * @description Optional authentication middleware.
 *
 * Identical to `authenticate`, EXCEPT it never rejects the request. If a valid
 * token (cookie or Bearer) is present it populates `req.user`; if absent or
 * invalid the request continues with `req.user` undefined. This is used on
 * public read endpoints (e.g. public course listing) so that anonymous visitors
 * still work, while authenticated instructors/admins get their owner-scoped
 * view.
 */

import User from "../models/user.model.js";
import { verifyAccessToken } from "../utils/auth/index.js";

/**
 * Extract the access token from a request (cookie or Bearer header).
 */
const extractAccessToken = (req) => {
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
};

const authenticateOptional = async (req, res, next) => {
  const token = extractAccessToken(req);

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyAccessToken(token);

    // eslint-disable-next-line no-await-in-loop
    const user = await User.findById(decoded.id).select("-password");

    if (user) {
      req.user = user;
    }
  } catch {
    // Ignore invalid/expired tokens on optional-auth routes.
  }

  next();
};

export default authenticateOptional;