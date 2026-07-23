import config from "../env.config.js";

const jwtConfig = Object.freeze({
  accessToken: {
    secret: config.jwt.accessSecret,
    expiresIn: config.jwt.accessExpiresIn,
    issuer: config.app.name,
    audience: config.client.url,
    algorithm: "HS256",
  },

  refreshToken: {
    secret: config.jwt.refreshSecret,
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: config.app.name,
    audience: config.client.url,
    algorithm: "HS256",
  },
});

export default jwtConfig;