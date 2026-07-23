import logger from "../config/logger.js";

/**
 * Morgan stream interface.
 * Redirects HTTP request logs to the Winston logger.
 */
const morganStream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

export default morganStream;