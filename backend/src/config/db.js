import mongoose from "mongoose";
import config from "./env.config.js";
import logger from "./logger.js";

/**
 * Establishes MongoDB connection using Mongoose
 * Sets up event listeners for connection lifecycle monitoring
 */
const connectDB = async () => {
  try {
    // Connect to MongoDB with URI from environment configuration
    await mongoose.connect(config.database.uri);

    logger.info("MongoDB connected successfully");

    // Connection event handlers for monitoring and debugging
    mongoose.connection.on("connected", () => {
      logger.info("MongoDB connection established");
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });

    // Handle runtime database errors
    mongoose.connection.on("error", (error) => {
      logger.error(`MongoDB Error: ${error.message}`);
    });

  } catch (error) {
    // Terminate application if initial connection fails
    logger.error(`MongoDB Connection Failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;