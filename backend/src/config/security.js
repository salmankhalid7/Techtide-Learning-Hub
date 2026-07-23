import config from "./env.config.js";
import logger from "./logger.js";

/**
 * Validates critical security configuration before
 * the application starts.
 *
 * Throws an error if a required configuration is missing.
 */
const validateSecurityConfig = () => {
  const requiredConfigs = [
    {
      key: "JWT Access Secret",
      value: config.jwt.accessSecret,
    },
    {
      key: "JWT Refresh Secret",
      value: config.jwt.refreshSecret,
    },
    {
      key: "MongoDB URI",
      value: config.database.uri,
    },
    {
      key: "Cookie Secret",
      value: config.cookie.secret,
    },
  ];

  for (const configItem of requiredConfigs) {
    if (!configItem.value) {
      throw new Error(
        `Missing required configuration: ${configItem.key}`
      );
    }
  }

  logger.info("Security configuration validated successfully.");
};

export default validateSecurityConfig;