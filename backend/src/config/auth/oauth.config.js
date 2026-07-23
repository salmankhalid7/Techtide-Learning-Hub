import config from "../env.config.js";

const oauthConfig = Object.freeze({
  google: {
    clientID: config.oauth.google.clientId,
    clientSecret: config.oauth.google.clientSecret,
    callbackURL: config.oauth.google.callbackURL,
    scope: ["profile", "email"],
  },

  github: {
    clientID: config.oauth.github.clientId,
    clientSecret: config.oauth.github.clientSecret,
    callbackURL: config.oauth.github.callbackURL,
    scope: ["user:email"],
  },
});

export default oauthConfig;