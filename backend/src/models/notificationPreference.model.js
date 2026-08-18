/**
 * @file notificationPreference.model.js
 * @description Notification preferences for a LearnX user.
 *
 * Each user has one preferences document controlling which notification
 * categories they receive (in-app) and whether they also get an email. A
 * single boolean `email` toggles email delivery globally; `categories` is an
 * object map (category -> enabled) so users can opt out per category.
 */

import mongoose from "mongoose";

import { NOTIFICATION_CATEGORIES } from "../constants/notification.constants.js";

const { Schema, model } = mongoose;

const CATEGORY_VALUES = Object.values(NOTIFICATION_CATEGORIES);

// Default: every category is enabled.
const defaultCategories = () =>
    CATEGORY_VALUES.reduce((acc, cat) => {
        acc[cat] = true;
        return acc;
    }, {});

const notificationPreferenceSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },

        // Email delivery master switch (in-app is always on unless a category
        // is disabled).
        email: {
            type: Boolean,
            default: true,
        },

        // Whether the notification bell is on at all.
        inApp: {
            type: Boolean,
            default: true,
        },

        // Per-category enable map: { course: true, enrollment: true, ... }.
        categories: {
            type: Schema.Types.Mixed,
            default: defaultCategories,
        },
    },
    { timestamps: true, versionKey: false }
);

const NotificationPreference = model("NotificationPreference", notificationPreferenceSchema);

export default NotificationPreference;
