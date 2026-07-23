/**
 * Common Validator
 * Reusable validation rules shared across route groups.
 */

import { param } from "express-validator";

// Validates a route param is a valid MongoDB ObjectId; defaults to "id"
export const mongoIdValidator = (field = "id") => {
  return param(field)
    .isMongoId()
    .withMessage(`Invalid ${field}`);
};