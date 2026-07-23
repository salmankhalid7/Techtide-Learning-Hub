import mongoose from "mongoose";

import { config } from "../config/index.js";
import ApiResponse from "../utils/apiResponse.js";

/**
 * Returns basic API information.
 */
export const getApiInfo = (req, res) => {
  res.status(200).json(
    new ApiResponse(200, "API information retrieved", {
      name: config.app.name,
      version: config.app.apiVersion,
      environment: config.app.env,
      status: "online",
      timestamp: new Date().toISOString(),

      endpoints: {
        health: `/api/${config.app.apiVersion}/health`,
      },

      documentation: "/docs",
    })
  );
};

/**
 * Returns the current health status of the application.
 */
export const getHealthStatus = (req, res) => {
  const databaseStatus =
    mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected";

  res.status(200).json(
    new ApiResponse(200, "Health check successful", {
      status: "healthy",

      application: {
        name: config.app.name,
        version: config.app.apiVersion,
        environment: config.app.env,
      },

      server: {
        uptime: Number(process.uptime().toFixed(2)),
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
      },

      database: {
        status: databaseStatus,
      },

      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    })
  );
};