/**
 * @file notification.model.js
 * @description Notification model for the LearnX LMS.
 *
 * An in-app notification delivered to a single recipient (student, instructor
 * or admin). Each notification carries a type (mapped to a category), a human
 * title/body, and an optional `data` object with entity references (course,
 * payment, quiz, task, review...) so the client can deep-link.
 *
 * State: isRead (read/unread), deletedAt (soft delete).
 */

import mongoose from "mongoose";

import {
    NOTIFICATION_TYPES,
    NOTIFICATION_TYPE_CATEGORY,
} from "../constants/notification.constants.js";

const { Schema, model } = mongoose;

const NOTIFICATION_TYPE_VALUES = Object.values(NOTIFICATION_TYPES);

const notificationSchema = new Schema(
    {
        /* ── Recipient ─────────────────────────────────────────── */
        recipient: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        /* ── Typing ────────────────────────────────────────────── */
        type: {
            type: String,
            enum: NOTIFICATION_TYPE_VALUES,
            required: true,
        },
        category: {
            type: String,
            required: true,
        },

        /* ── Content ───────────────────────────────────────────── */
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        body: {
            type: String,
            trim: true,
            default: "",
            maxlength: 2000,
        },

        /* ── Deep-link / contextual data ───────────────────────── */
        // { course?, module?, lesson?, quiz?, attempt?, task?, submission?,
        //   review?, payment?, order?, image?, url? }
        data: {
            type: Schema.Types.Mixed,
            default: {},
        },

        /* ── State ─────────────────────────────────────────────── */
        isRead: {
            type: Boolean,
            default: false,
            index: true,
        },
        readAt: {
            type: Date,
            default: null,
        },

        // Optional actor (who triggered the event, e.g. the student who enrolled).
        actor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        deletedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true, versionKey: false }
);

/* ── Indexes ─────────────────────────────────────────────────────────── */
// Per-recipient, newest-first listing (the common read path).
notificationSchema.index({ recipient: 1, createdAt: -1 });
// Unread count for a recipient.
notificationSchema.index({ recipient: 1, isRead: 1, deletedAt: 1 });

/* ── Soft-delete auto filter ─────────────────────────────────────────── */
notificationSchema.pre(/^find/, function () {
    this.where({ deletedAt: null });
});

const Notification = model("Notification", notificationSchema);

export default Notification;
