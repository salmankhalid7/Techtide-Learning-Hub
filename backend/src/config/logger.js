import winston from "winston";

/**
 * Machine-readable format used by file transports
 * and production environments.
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Readable format for local development.
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: "HH:mm:ss",
  }),
  winston.format.printf(
    ({ timestamp, level, message, stack }) => {
      return stack
        ? `[${timestamp}] ${level}: ${stack}`
        : `[${timestamp}] ${level}: ${message}`;
    }
  )
);

// Dynamically import config to break the circular dependency:
//   config/index.js → logger.js → config/index.js
// By the time createLogger() is called below, config is fully initialized.
const config = await import("./env.config.js").then((m) => m.default);

const logger = winston.createLogger({
  levels: winston.config.npm.levels,

  level: config.logger.level,

  defaultMeta: {
    service: config.app.name,
  },

  transports: [
    /**
     * Development console logs.
     */
    new winston.transports.Console({
      format:
        config.app.env === "development"
          ? consoleFormat
          : fileFormat,
    }),

    /**
     * Stores all application logs.
     */
    new winston.transports.File({
      filename: "logs/combined.log",
      format: fileFormat,
    }),

    /**
     * Stores only error logs.
     */
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: fileFormat,
    }),
  ],

  /**
   * Prevent process termination when a logger transport fails.
   */
  exitOnError: false,
});

export default logger;