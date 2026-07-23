/**
 * Validation Middleware
 * Checks express-validator results and returns structured errors if validation fails.
 */

import { validationResult } from "express-validator";
import { BadRequestError } from "../errors/index.js";

const validate = (req, res, next) => {
  // Collect validation errors from previous middleware
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Forward a 400 error with structured field-level error details
    const fieldErrors = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
    }));

    return next(new BadRequestError("Validation failed", fieldErrors));
  }

  // No validation errors — proceed to the next handler
  next();
};

export default validate;