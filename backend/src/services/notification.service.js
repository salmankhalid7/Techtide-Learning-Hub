/**
 * @file notification.service.js
 * @description Notification service for the LearnX LMS.
 *
 * Core capabibilities:
 *   - Emit notifications to one or many recipients (respecting preferences).
 *   - Read: list + unread count.
 *   - Update: mark read, mark all read.
 *   - Delete: single or all (soft delete).
 *   - Preferences: read/update per-user category + channel toggles.
 *
 * All notifications are stored in-app. `notifyUser` also honours preferences
 * so a user who disabled a category or the umbrella in-app switch never gets
 * a notification they opted out of.
 */

import Notification from "../models/notification.model.js";
import NotificationPreference from "../models/notificationPreference.model.js";

import {
    NOTIFICATION_TYPE_CATEGORY,
    NOTIFICATION_TYPE_LABELS,
} from "../constants/notification.constants.js";

import {
    NotFoundError,
    BadRequestError,
    ForbiddenError,
} from "../errors/index.js";
import logger from "../config/logger.js";

/* ────────────────────────────────────────────────────────────────────── */
/*  Emission (used by other services)                                     */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Create a notification for a single recipient, subject to their preferences.
 *
 * @param {Object} opts
 * @param {string} opts.recipient - User _id to notify.
 * @param {string} opts.type     - a NOTIFICATION_TYPES value.
 * @param {string} [opts.title]  - override; defaults from the type label.
 * @param {string} [opts.body]
 * @param {Object} [opts.data]
 * @param {string} [opts.actor]
 * @returns {Promise<Notification|null>} null if the recipient opted out.
 */
export const notifyUser = async ({
    recipient,
    type,
    title,
    body = "",
    data = {},
    actor = null,
}) => {
    if (!recipient) return null;

    const category = NOTIFICATION_TYPE_CATEGORY[type] || "system";

    // Respect the recipient's preferences.
    const allowed = await _recipientAllows(recipient, category);
    if (!allowed) return null;

    const notification = await Notification.create({
        recipient,
        type,
        category,
        title: title || NOTIFICATION_TYPE_LABELS[type] || "Notification",
        body,
        data: data || {},
        actor: actor || null,
    });

    return notification;
};

/**
 * Create a notification for many recipients (e.g. all enrolled students).
 * Preference-filtered per recipient; returns the list of created notifications.
 *
 * @param {Object} opts
 * @param {string[]} opts.recipients - array of User _ids.
 * ...same remaining options as notifyUser.
 */
export const notifyUsers = async ({ recipients = [], type, title, body = "", data = {}, actor = null }) => {
    const created = [];
    const unique = [...new Set((recipients || []).map((r) => String(r)))];
    for (const recipient of unique) {
        const n = await notifyUser({ recipient, type, title, body, data, actor });
        if (n) created.push(n);
    }
    return created;
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Read                                                                ── */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * List a user's notifications (newest first) with pagination + optional
 * unread-only filter.
 */
export const getMyNotifications = async ({ userId, page = 1, limit = 10, unreadOnly = false }) => {
    const filter = { recipient: userId };
    if (unreadOnly) filter.isRead = false;

    const [notifications, total] = await Promise.all([
        Notification.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Notification.countDocuments(filter),
    ]);

    return {
        notifications,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Count unread notifications for a user.
 */
export const getUnreadCount = async ({ userId }) => {
    const count = await Notification.countDocuments({
        recipient: userId,
        isRead: false,
        deletedAt: null,
    });
    return { count };
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Update                                                              ── */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Mark a single notification as read (owner only).
 */
export const markAsRead = async ({ notificationId, userId }) => {
    const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId,
    });
    if (!notification) {
        throw new NotFoundError("Notification not found");
    }
    if (notification.isRead) return notification;

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
    return notification;
};

/**
 * Mark all of a user's notifications as read.
 */
export const markAllAsRead = async ({ userId }) => {
    const res = await Notification.updateMany(
        { recipient: userId, isRead: false },
        { $set: { isRead: true, readAt: new Date() } }
    );
    return { modified: res.modifiedCount || 0 };
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Delete                                                              ── */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Soft-delete a single notification (owner only).
 */
export const deleteNotification = async ({ notificationId, userId }) => {
    const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId,
    });
    if (!notification) {
        throw new NotFoundError("Notification not found");
    }
    notification.deletedAt = new Date();
    await notification.save();
    return { deleted: true, notificationId };
};

/**
 * Soft-delete all notifications for a user.
 */
export const deleteAllNotifications = async ({ userId }) => {
    const res = await Notification.updateMany(
        { recipient: userId },
        { $set: { deletedAt: new Date() } }
    );
    return { deleted: res.modifiedCount || 0 };
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Preferences                                                        ── */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Get a user's notification preferences (creating defaults on first read).
 */
export const getPreferences = async ({ userId }) => {
    let prefs = await NotificationPreference.findOne({ user: userId });
    if (!prefs) {
        prefs = await NotificationPreference.create({ user: userId });
    }
    return prefs;
};

/**
 * Update a user's notification preferences.
 *
 * Allowed fields: email (bool), inApp (bool), and categories (object map of
 * category -> enabled).
 */
export const updatePreferences = async ({ userId, data }) => {
    let prefs = await NotificationPreference.findOne({ user: userId });
    if (!prefs) {
        prefs = await NotificationPreference.create({ user: userId });
    }

    if (data.email !== undefined) prefs.email = Boolean(data.email);
    if (data.inApp !== undefined) prefs.inApp = Boolean(data.inApp);

    if (data.categories && typeof data.categories === "object") {
        // Build a NEW object so Mongoose (Mixed type) reliably detects the
        // change; don't mutate the existing categories reference in place.
        const current = { ...(prefs.categories || {}) };
        for (const [key, val] of Object.entries(data.categories)) {
            if (typeof current[key] === "boolean" || key in current) {
                current[key] = Boolean(val);
            }
        }
        prefs.categories = current;
    }

    await prefs.save();
    logger.info("Notification preferences updated.", { userId });
    return prefs;
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Private helpers                                                     ── */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Whether a recipient allows a given notification category.
 * A user opts out if: inApp is false, OR the category is disabled.
 */
const _recipientAllows = async (recipientId, category) => {
    try {
        const prefs = await NotificationPreference.findOne({ user: recipientId });
        if (!prefs) return true; // no pref doc => default-allowed.
        if (prefs.inApp === false) return false;
        const categories = prefs.categories || {};
        if (categories[category] === false) return false;
        return true;
    } catch {
        // If preferences can't be read, err on the side of delivering.
        return true;
    }
};
