/**
 * @file announcement.model.js
 * @description Course Announcement model for the LearnX LMS.
 *
 * An instructor posts announcements to the students enrolled in a course
 * (e.g. "New lesson added to Module 4"). Announcements are course-scoped and
 * soft-deletable.
 */

import mongoose from "mongoose";

import { ANNOUNCEMENT_STATUS } from "../constants/announcement.constants.js";

const { Schema, model } = mongoose;

const ANNOUNCEMENT_STATUS_VALUES = Object.values(ANNOUNCEMENT_STATUS);

const announcementSchema = new Schema(
    {
        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true,
            index: true,
        },
        instructor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        body: {
            type: String,
            required: true,
            trim: true,
            maxlength: 10000,
        },

        // Optional: schedule publication for a future time.
        publishAt: {
            type: Date,
            default: null,
        },

        status: {
            type: String,
            enum: ANNOUNCEMENT_STATUS_VALUES,
            default: ANNOUNCEMENT_STATUS.DRAFT,
            index: true,
        },
        publishedAt: {
            type: Date,
            default: null,
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        updatedBy: {
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
// Student feed: published announcements for a course, newest first.
announcementSchema.index({ course: 1, status: 1, createdAt: -1 });

/* ── Soft-delete auto filter ─────────────────────────────────────────── */
announcementSchema.pre(/^find/, function () {
    this.where({ deletedAt: null });
});

const Announcement = model("Announcement", announcementSchema);

export default Announcement;
