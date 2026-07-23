import jwt from "jsonwebtoken";
import { jwtConfig } from "../../config/index.js";

export const generateAccessToken = (userData) => {
  const payload = typeof userData === "object" && userData !== null
    ? { id: userData.id || userData._id || userData }
    : { id: userData };

  return jwt.sign(payload, jwtConfig.accessToken.secret, {
    expiresIn: jwtConfig.accessToken.expiresIn,
    issuer: jwtConfig.accessToken.issuer,
    audience: jwtConfig.accessToken.audience,
    algorithm: jwtConfig.accessToken.algorithm,
  });
};

export const generateRefreshToken = (userData) => {
  const payload = typeof userData === "object" && userData !== null
    ? { id: userData.id || userData._id || userData }
    : { id: userData };

  return jwt.sign(payload, jwtConfig.refreshToken.secret, {
    expiresIn: jwtConfig.refreshToken.expiresIn,
    issuer: jwtConfig.refreshToken.issuer,
    audience: jwtConfig.refreshToken.audience,
    algorithm: jwtConfig.refreshToken.algorithm,
  });
};