import { param } from "express-validator";
import mongoose from "mongoose";

/**
 * Reusable MongoDB ObjectId validation rule.
 *
 * @param {string} field - Route parameter name.
 */
export const objectIdRule = (field = "id") =>
  param(field)
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage(`Invalid ${field}.`);