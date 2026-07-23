import jwt from "jsonwebtoken";

import { jwtConfig } from "../../config/index.js";

export const verifyAccessToken = (token) => {
  return jwt.verify(token, jwtConfig.accessToken.secret, {
    algorithms: [jwtConfig.accessToken.algorithm],
  });
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, jwtConfig.refreshToken.secret, {
    algorithms: [jwtConfig.refreshToken.algorithm],
  });
};