/**
 * @file notification.routes.js
 * @description Routes for the LearnX notification system.
 *
 * NOTE: literal sub-paths (/mine, /preferences, /unread-count, /read-all,
 * /clear) are registered BEFORE /:notificationId so Express does not treat the
 * literal segment as a notification ObjectId.
 */

import { Router } from "express";

import {
    getMyNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    getPreferences,
    updatePreferences,
} from "../controllers/notification.controller.js";

import {
    getMyNotificationsValidator,
    notificationIdRule,
    updatePreferencesValidator,
} from "../validators/notification.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

// All notification endpoints require authentication (recipient = requester).
router.use(authenticate);

/* ── Literal sub-paths (registered first) ───────────────────────────── */
router.get("/notifications/mine", getMyNotificationsValidator, validate, getMyNotifications);
router.get("/notifications/unread-count", getUnreadCount);
router.patch("/notifications/read-all", markAllAsRead);
router.delete("/notifications/clear", deleteAllNotifications);

/* ── Preferences ────────────────────────────────────────────────────── */
router.get("/notifications/preferences", getPreferences);
router.patch(
    "/notifications/preferences",
    updatePreferencesValidator,
    validate,
    updatePreferences
);

/* ── Param-based paths (by id) ──────────────────────────────────────── */
router.patch("/notifications/:notificationId/read", ...notificationIdRule(), validate, markAsRead);
router.delete("/notifications/:notificationId", ...notificationIdRule(), validate, deleteNotification);

export default router;
