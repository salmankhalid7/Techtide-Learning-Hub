/**
 * @file admin-dashboard.routes.js
 * @description Dedicated admin dashboard routes.
 *
 * Kept separate from the instructor dashboard router so admin and instructor
 * responsibilities don't mix. Both are private (require authentication); this
 * router additionally requires the admin role. Note: `authorize` compares
 * against the lowercase `req.user.role` value ("admin"), so the role string
 * must be lowercase to match the User model enum.
 */

import { Router } from "express";

import {
    getAdminDashboard,
    getAdminOverview,
    getUserAnalytics,
    getCourseAnalytics,
    getEnrollmentAnalytics,
    getPlatformHealth,
    getRevenueAnalytics,
    getRecentActivity,
    getAdminActionCenter,
} from "../controllers/dashboard.controller.js";

import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";
import validate from "../middlewares/validation.middleware.js";

import {
    validateAdminOverview,
    validateUserAnalytics,
    validateCourseAnalytics,
    validateEnrollmentAnalytics,
    validatePlatformHealth,
    validateRevenueAnalytics,
    validateRecentActivity,
    validateAdminActionCenter,
} from "../validators/dashboard.validator.js";

const router = Router();

// All admin dashboard routes require authentication + admin role.
router.use(authenticate, authorize("admin"));

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get complete admin dashboard (composite of all admin analytics)
 * @access  Private (Admin)
 */
router.get("/", getAdminDashboard);

/**
 * @route   GET /api/v1/admin/dashboard/overview
 * @desc    Platform-wide admin overview (summary metrics)
 * @access  Private (Admin)
 */
router.get("/overview", validateAdminOverview, validate, getAdminOverview);

/**
 * @route   GET /api/v1/admin/dashboard/users
 * @desc    User analytics (growth, recent registrations, recently active)
 * @access  Private (Admin)
 */
router.get("/users", validateUserAnalytics, validate, getUserAnalytics);

/**
 * @route   GET /api/v1/admin/dashboard/courses
 * @desc    Course analytics (popular, highest rated, recently published/created)
 * @access  Private (Admin)
 */
router.get("/courses", validateCourseAnalytics, validate, getCourseAnalytics);

/**
 * @route   GET /api/v1/admin/dashboard/enrollments
 * @desc    Enrollment analytics (trends and completion)
 * @access  Private (Admin)
 */
router.get("/enrollments", validateEnrollmentAnalytics, validate, getEnrollmentAnalytics);

/**
 * @route   GET /api/v1/admin/dashboard/platform-health
 * @desc    Platform health (issues that need attention)
 * @access  Private (Admin)
 */
router.get("/platform-health", validatePlatformHealth, validate, getPlatformHealth);

/**
 * @route   GET /api/v1/admin/dashboard/revenue
 * @desc    Revenue analytics (placeholder until payments are implemented)
 * @access  Private (Admin)
 */
router.get("/revenue", validateRevenueAnalytics, validate, getRevenueAnalytics);

/**
 * @route   GET /api/v1/admin/dashboard/recent-activity
 * @desc    Recent platform activity (merged timeline)
 * @access  Private (Admin)
 */
router.get("/recent-activity", validateRecentActivity, validate, getRecentActivity);

/**
 * @route   GET /api/v1/admin/dashboard/action-center
 * @desc    Actionable tasks that require the admin's attention
 * @access  Private (Admin)
 */
router.get("/action-center", validateAdminActionCenter, validate, getAdminActionCenter);

export default router;
