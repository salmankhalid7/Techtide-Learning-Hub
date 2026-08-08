/**
 * @file dashboard.routes.js
 * @description RESTful routes for Dashboard APIs.
 *
 * All routes are private (require authentication). Instructor routes are
 * restricted to instructors; admin routes are grouped separately and
 * restricted to admins. Each defines its own validation chain + validation
 * middleware.
 */

import { Router } from "express";

import {
    getDashboardOverview,
    getRecentCourses,
    getRecentEnrollments,
    getTopCourses,
    getMonthlyEnrollments,
    getEngagementStats,
    getEarningsStats,
    getActionCenter,
    getDashboardStats,
} from "../controllers/dashboard.controller.js";

import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";
import validate from "../middlewares/validation.middleware.js";

import {
    validateDashboardOverview,
    validateRecentCourses,
    validateRecentEnrollments,
    validateTopCourses,
    validateMonthlyEnrollments,
    validateEngagementStats,
    validateEarningsStats,
    validateActionCenter,
} from "../validators/dashboard.validator.js";

const router = Router();

/* ─────────────────────────── Instructor routes ─────────────────────────── */

// All instructor dashboard routes require authentication + instructor role.
router.use(authenticate, authorize("instructor"));

/**
 * @route   GET /api/v1/instructor/dashboard
 * @desc    Get dashboard overview (summary metrics)
 * @access  Private (Instructor)
 */
router.get("/", validateDashboardOverview, validate, getDashboardOverview);

/**
 * @route   GET /api/v1/instructor/dashboard/recent-courses
 * @desc    Get the instructor's most recent courses (paginated)
 * @access  Private (Instructor)
 */
router.get("/recent-courses", validateRecentCourses, validate, getRecentCourses);

/**
 * @route   GET /api/v1/instructor/dashboard/recent-enrollments
 * @desc    Get the most recent enrollments across the instructor's courses (paginated)
 * @access  Private (Instructor)
 */
router.get("/recent-enrollments", validateRecentEnrollments, validate, getRecentEnrollments);

/**
 * @route   GET /api/v1/instructor/dashboard/top-courses
 * @desc    Get the instructor's top-performing courses
 * @access  Private (Instructor)
 */
router.get("/top-courses", validateTopCourses, validate, getTopCourses);

/**
 * @route   GET /api/v1/instructor/dashboard/monthly-enrollments
 * @desc    Get monthly enrollment analytics (optionally filtered by year)
 * @access  Private (Instructor)
 */
router.get("/monthly-enrollments", validateMonthlyEnrollments, validate, getMonthlyEnrollments);

/**
 * @route   GET /api/v1/instructor/dashboard/engagement
 * @desc    Get student engagement analytics
 * @access  Private (Instructor)
 */
router.get("/engagement", validateEngagementStats, validate, getEngagementStats);

/**
 * @route   GET /api/v1/instructor/dashboard/earnings
 * @desc    Get earnings dashboard foundation
 * @access  Private (Instructor)
 */
router.get("/earnings", validateEarningsStats, validate, getEarningsStats);

/**
 * @route   GET /api/v1/instructor/dashboard/action-center
 * @desc    Get items requiring the instructor's attention
 * @access  Private (Instructor)
 */
router.get("/action-center", validateActionCenter, validate, getActionCenter);

/**
 * @route   GET /api/v1/instructor/dashboard/overview
 * @desc    Legacy aggregated dashboard payload (composes all analytics)
 * @access  Private (Instructor)
 */
router.get("/overview", validateDashboardOverview, validate, getDashboardStats);

export default router;
