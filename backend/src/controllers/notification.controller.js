/**
 * @file notification.controller.js
 * @description Controllers for the LearnX notification system.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";

import {
    getMyNotifications as getMyNotificationsService,
    getUnreadCount as getUnreadCountService,
    markAsRead as markAsReadService,
    markAllAsRead as markAllAsReadService,
    deleteNotification as deleteNotificationService,
    deleteAllNotifications as deleteAllNotificationsService,
    getPreferences as getPreferencesService,
    updatePreferences as updatePreferencesService,
} from "../services/notification.service.js";

/**
 * GET /notifications/mine
 */
const getMyNotifications = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const unreadOnly = req.query.unread === "true";
    const result = await getMyNotificationsService({
        userId: req.user._id,
        page,
        limit,
        unreadOnly,
    });
    return res.status(200).json(new ApiResponse(200, "Notifications fetched.", result));
});

/**
 * GET /notifications/unread-count
 */
const getUnreadCount = asyncHandler(async (req, res) => {
    const result = await getUnreadCountService({ userId: req.user._id });
    return res.status(200).json(new ApiResponse(200, "Unread count fetched.", result));
});

/**
 * PATCH /notifications/:notificationId/read
 */
const markAsRead = asyncHandler(async (req, res) => {
    const notification = await markAsReadService({
        notificationId: req.params.notificationId,
        userId: req.user._id,
    });
    return res.status(200).json(new ApiResponse(200, "Notification marked as read.", notification));
});

/**
 * PATCH /notifications/read-all
 */
const markAllAsRead = asyncHandler(async (req, res) => {
    const result = await markAllAsReadService({ userId: req.user._id });
    return res.status(200).json(new ApiResponse(200, "All notifications marked as read.", result));
});

/**
 * DELETE /notifications/:notificationId
 */
const deleteNotification = asyncHandler(async (req, res) => {
    const result = await deleteNotificationService({
        notificationId: req.params.notificationId,
        userId: req.user._id,
    });
    return res.status(200).json(new ApiResponse(200, "Notification deleted.", result));
});

/**
 * DELETE /notifications/clear
 */
const deleteAllNotifications = asyncHandler(async (req, res) => {
    const result = await deleteAllNotificationsService({ userId: req.user._id });
    return res.status(200).json(new ApiResponse(200, "All notifications cleared.", result));
});

/* ── Preferences ─────────────────────────────────────────────────────── */

/**
 * GET /notifications/preferences
 */
const getPreferences = asyncHandler(async (req, res) => {
    const prefs = await getPreferencesService({ userId: req.user._id });
    return res.status(200).json(new ApiResponse(200, "Notification preferences fetched.", prefs));
});

/**
 * PATCH /notifications/preferences
 */
const updatePreferences = asyncHandler(async (req, res) => {
    const prefs = await updatePreferencesService({
        userId: req.user._id,
        data: req.body,
    });
    return res.status(200).json(new ApiResponse(200, "Notification preferences updated.", prefs));
});

export {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    getPreferences,
    updatePreferences,
};
