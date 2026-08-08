/**
 * Authenticate Middleware
 *
 * 1. Read the access token — from the `accessToken` cookie (browser) OR the
 *    `Authorization: Bearer <token>` header (API clients / mobile / tools).
 *    The cookie takes priority when both are present.
 * 2. Verify JWT
 * 3. Find user from database
 * 4. Attach user to req.user
 * 5. Continue request
 */

import User from "../models/user.model.js";
import { UnauthorizedError } from "../errors/index.js";
import { verifyAccessToken } from "../utils/auth/index.js";

/**
 * Extract the access token from a request.
 *
 * Supports two sources so both browser cookie auth and bearer-token API auth
 * work against the same middleware:
 *   - `req.cookies.accessToken`         (httpOnly cookie, used by browsers)
 *   - `Authorization: Bearer <token>`   (used by API clients, mobile, tools)
 * The cookie takes priority when both are present.
 * @param {import("express").Request} req
 * @returns {string|null}
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

const authenticate = async (req, res, next) => {
  const token = extractAccessToken(req);

  if (!token) {
    return next(new UnauthorizedError("Authentication required."));
  }

  let decoded;

  try {
    decoded = verifyAccessToken(token);
  } catch {
    // Only clear cookies if they were the source of the (invalid) token.
    if (req.cookies?.accessToken) {
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
    }
    return next(new UnauthorizedError("Invalid or expired authentication token."));
  }

  const user = await User.findById(decoded.id).select("-password");

  if (!user) {
    if (req.cookies?.accessToken) {
      res.clearCookie("accessToken");
      res.clearCookie("refreshToken");
    }
    return next(new UnauthorizedError("User no longer exists."));
  }

  req.user = user;

  next();
};

export default authenticate;
