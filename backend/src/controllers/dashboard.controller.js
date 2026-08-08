/**
 * @file dashboard.controller.js
 * @description Controllers for the Instructor Dashboard APIs.
 *
 * Each controller is intentionally thin: it delegates to a single service
 * method and returns a consistent API response. No business logic lives here.
 */

import httpStatus from "http-status";

import dashboardService from "../services/dashboard.service.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";

/**
 * GET /instructor/dashboard
 * Dashboard overview (summary metrics).
 */
export const getDashboardOverview = asyncHandler(async (req, res) => {
    const data = await dashboardService.getDashboardOverview(req.user.id);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Dashboard overview retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/recent-courses
 * Paginated list of the instructor's most recent courses.
 */
export const getRecentCourses = asyncHandler(async (req, res) => {
    const data = await dashboardService.getRecentCourses(req.user.id, req.query);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Recent courses retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/recent-enrollments
 * Paginated list of the most recent enrollments across the instructor's courses.
 */
export const getRecentEnrollments = asyncHandler(async (req, res) => {
    const data = await dashboardService.getRecentEnrollments(req.user.id, req.query);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Recent enrollments retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/top-courses
 * Top-performing courses by enrollment count and rating.
 */
export const getTopCourses = asyncHandler(async (req, res) => {
    const { limit = 5 } = req.query;
    const data = await dashboardService.getTopCourses(req.user.id, Number(limit));

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Top courses retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/monthly-enrollments
 * Monthly enrollment analytics, optionally filtered by year.
 */
export const getMonthlyEnrollments = asyncHandler(async (req, res) => {
    const { year } = req.query;
    const data = await dashboardService.getMonthlyEnrollments(req.user.id, {
        year: year ? Number(year) : undefined,
    });

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Monthly enrollment analytics retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/engagement
 * Student engagement analytics.
 */
export const getEngagementStats = asyncHandler(async (req, res) => {
    const data = await dashboardService.getEngagementStats(req.user.id);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Engagement analytics retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/earnings
 * Earnings dashboard foundation.
 */
export const getEarningsStats = asyncHandler(async (req, res) => {
    const data = await dashboardService.getEarningsStats(req.user.id);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Earnings analytics retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/action-center
 * Items that require the instructor's attention.
 */
export const getActionCenter = asyncHandler(async (req, res) => {
    const data = await dashboardService.getActionCenter(req.user.id);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Action center retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/overview (legacy aggregated overview)
 * Composes all dashboard analytics into a single payload.
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
    const data = await dashboardService.getDashboardStats(req.user.id);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Instructor dashboard retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/admin/overview
 * Platform-wide admin overview (summary metrics across the entire platform).
 */
export const getAdminOverview = asyncHandler(async (req, res) => {
    const data = await dashboardService.getAdminOverview();

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Admin overview retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/admin/users
 * User analytics (growth, recent registrations, recently active users).
 */
export const getUserAnalytics = asyncHandler(async (req, res) => {
    const data = await dashboardService.getUserAnalytics(req.query);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "User analytics retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/admin/courses
 * Course analytics (popular courses, highest rated, recently published/created).
 */
export const getCourseAnalytics = asyncHandler(async (req, res) => {
    const data = await dashboardService.getCourseAnalytics(req.query);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Course analytics retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/admin/enrollments
 * Enrollment analytics (trends and completion, not course details).
 */
export const getEnrollmentAnalytics = asyncHandler(async (req, res) => {
    const data = await dashboardService.getEnrollmentAnalytics(req.query);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Enrollment analytics retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/admin/platform-health
 * Platform health analytics (issues that need attention).
 */
export const getPlatformHealth = asyncHandler(async (req, res) => {
    const data = await dashboardService.getPlatformHealth();

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Platform health retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/admin/revenue
 * Revenue analytics (placeholder until the payment module is implemented).
 */
export const getRevenueAnalytics = asyncHandler(async (req, res) => {
    const data = await dashboardService.getRevenueAnalytics(req.query);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Revenue analytics retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/admin/recent-activity
 * Recent platform activity (merged timeline of multiple collections).
 */
export const getRecentActivity = asyncHandler(async (req, res) => {
    const data = await dashboardService.getRecentActivity(req.query);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Recent activity retrieved successfully.", data));
});

/**
 * GET /instructor/dashboard/admin/action-center
 * Actionable tasks that require the admin's attention.
 */
export const getAdminActionCenter = asyncHandler(async (req, res) => {
    const actions = await dashboardService.getAdminActionCenter();

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Admin action center retrieved successfully.", actions));
});

/**
 * GET /admin/dashboard
 * Complete admin dashboard (composite of all admin analytics).
 */
export const getAdminDashboard = asyncHandler(async (req, res) => {
    const dashboard = await dashboardService.getAdminDashboard(req.query);

    return res
        .status(httpStatus.OK)
        .json(new ApiResponse(httpStatus.OK, "Admin dashboard retrieved successfully.", dashboard));
});
