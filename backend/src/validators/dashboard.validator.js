/**
 * @file dashboard.validator.js
 * @description Validation chains for the Instructor Dashboard APIs.
 *
 * Endpoints may not all take parameters today, but defining validators now
 * keeps the architecture consistent and makes future extensions easy.
 */

import { query } from "express-validator";

/**
 * Reusable pagination rules (limit + page).
 * @returns {import("express-validator").ValidationChain[]}
 */
const paginationRules = () => [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer."),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100."),
];

/**
 * Validation chain for the dashboard overview (GET /).
 * No parameters are currently accepted; kept for architectural consistency.
 */
export const validateDashboardOverview = [];

/**
 * Validation chain for recent courses (GET /recent-courses).
 * Accepts optional `page`, `limit`, `search`, `status`, `sortBy` and
 * `sortOrder` query params.
 */
export const validateRecentCourses = [
  ...paginationRules(),
  query("search")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage("Search must be a 1-120 character string."),
  query("status")
    .optional()
    .isIn(["DRAFT", "PUBLISHED", "ARCHIVED"])
    .withMessage("Status must be DRAFT, PUBLISHED or ARCHIVED."),
  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "title"])
    .withMessage("sortBy must be createdAt, updatedAt or title."),
  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("sortOrder must be asc or desc."),
];

/**
 * Validation chain for recent enrollments (GET /recent-enrollments).
 * Accepts optional `page` and `limit` query params.
 */
export const validateRecentEnrollments = [...paginationRules()];

/**
 * Validation chain for top courses (GET /top-courses).
 * Accepts an optional `limit` query param.
 */
export const validateTopCourses = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100."),
];

/**
 * Validation chain for monthly enrollments analytics (GET /monthly-enrollments).
 * Accepts an optional `year` query param (4-digit year).
 */
export const validateMonthlyEnrollments = [
  query("year")
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage("Year must be a valid 4-digit year."),
];

/**
 * Validation chain for engagement analytics (GET /engagement).
 * No parameters are currently accepted; kept for architectural consistency.
 */
export const validateEngagementStats = [];

/**
 * Validation chain for earnings analytics (GET /earnings).
 * No parameters are currently accepted; kept for architectural consistency.
 */
export const validateEarningsStats = [];

/**
 * Validation chain for action center (GET /action-center).
 * No parameters are currently accepted; kept for architectural consistency.
 */
export const validateActionCenter = [];
