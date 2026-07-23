import config from "../env.config.js";

const baseCookieOptions = {
  httpOnly: true,
  secure: config.app.env === "production",
  sameSite: config.app.env === "production" ? "none" : "lax",
  path: "/",
};

const cookieConfig = Object.freeze({
  accessToken: {
    ...baseCookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  },

  refreshToken: {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});

export default cookieConfig;