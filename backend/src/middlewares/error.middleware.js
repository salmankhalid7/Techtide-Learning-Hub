/**
 * Global Error Handler Middleware
 *
 * Centralizes error handling for the entire application.
 * Converts various error types (Mongoose, JWT, etc.) into standardized API responses.
 * Provides appropriate HTTP status codes and error messages based on error type.
 * Includes stack traces only in development environment.
 */
import multer from "multer";

import { config } from "../config/index.js";
import logger from "../config/logger.js";
import {
  AppError,
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from "../errors/index.js";

const errorHandler = (err, req, res, next) => {
  // Log the full error context for debugging
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  let error = err;

  // ── Multer errors ──────────────────────────────────────────
  if (err instanceof multer.MulterError) {
    error = new BadRequestError(err.message);
  }

  // ── Mongoose Validation Error ──────────────────────────────
  else if (err.name === "ValidationError") {
    const fieldErrors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));

    return res.status(400).json({
      success: false,
      statusCode: 400,
      message: "Validation failed",
      errors: fieldErrors,
    });
  }

  // ── MongoDB Duplicate Key Error ────────────────────────────
  else if (err.code === 11000) {
    error = new ConflictError("Duplicate key error.");
  }

  // ── Invalid MongoDB ObjectId ──────────────────────────────
  else if (err.name === "CastError") {
    error = new BadRequestError(`Invalid ${err.path}`);
  }

  // ── JWT Authentication Errors ─────────────────────────────
  else if (err.name === "JsonWebTokenError") {
    error = new UnauthorizedError("Invalid authentication token");
  } else if (err.name === "TokenExpiredError") {
    error = new UnauthorizedError("Authentication token has expired");
  }

  // ── Unknown errors → wrap in AppError ─────────────────────
  else if (!(err instanceof AppError)) {
    error = new AppError(
      err.message || "Internal Server Error",
      500
    );
  }

  // ── Standardized response ─────────────────────────────────
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    statusCode,
    message: error.message,
    errors: error.errors || [],
    ...(config.app.env === "development" && {
      stack: error.stack,
    }),
  });
};

export default errorHandler;