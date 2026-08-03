import { query } from "express-validator";

import validate from "../middlewares/validation.middleware.js";
import { objectIdRule } from "./rules/objectId.rule.js";

export const enrollStudentValidator = [
    objectIdRule("courseId"),
    validate,
];

export const getEnrollmentValidator = [
    objectIdRule("courseId"),
    validate,
];

export const getMyEnrollmentsValidator = [
    query("page")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer."),
    query("limit")
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100."),
    validate,
];

export const dropEnrollmentValidator = [
    objectIdRule("enrollmentId"),
    validate,
];