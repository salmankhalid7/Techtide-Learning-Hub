import mongoose from "mongoose";

import app from "./app.js";
import { config } from "./config/index.js";
import logger from "./config/logger.js";
import connectDB from "./config/db.js";
import validateSecurityConfig from "./config/security.js";
let server;

/**
 * Bootstraps the application by connecting to the database
 * before accepting incoming HTTP requests.
 */
const startServer = async () => {
  try {
    // Validate application security configuration.
    validateSecurityConfig();
    await connectDB();

    server = app.listen(config.app.port, () => {
      logger.info(
        `${config.app.name} is running on port ${config.app.port}`
      );
    });
  } catch (error) {
    logger.error(`Application startup failed: ${error.message}`);
    process.exit(1);
  }
};

startServer();

/**
 * Gracefully shuts down the application by closing the HTTP
 * server first, then the MongoDB connection.
 */
const shutdown = async (signal) => {
  logger.warn(`${signal} received. Starting graceful shutdown...`);

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      logger.info("HTTP server closed.");
    }

    await mongoose.connection.close();
    logger.info("MongoDB connection closed.");

    process.exit(0);
  } catch (error) {
    logger.error(`Shutdown failed: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Handle termination signals from the operating system.
 */
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

/**
 * Handle synchronous errors that escape the application.
 */
process.on("uncaughtException", async (error) => {
  logger.error(`Uncaught Exception: ${error.stack || error.message}`);

  await shutdown("UNCAUGHT_EXCEPTION");
});

/**
 * Handle rejected promises that were not caught.
 */
process.on("unhandledRejection", async (reason) => {
  logger.error(
    `Unhandled Promise Rejection: ${reason?.stack || reason?.message || reason
    }`
  );

  await shutdown("UNHANDLED_REJECTION");
});