/**
 * @file review.model.js
 * @description Review model for the LearnX course review/rating system.
 *
 * A student can submit exactly one review per course, tied to their
 * enrollment. Reviews are moderated; only APPROVED reviews contribute to the
 * course `statistics.averageRating` / `totalReviews` / rating distribution.
 *
 * Rating is 1–5. A soft-delete keeps audit history.
 */

import mongoose from "mongoose";

import {
    REVIEW_STATUS,
    RATING,
} from "../constants/review.constants.js";

const { Schema, model } = mongoose;

const REVIEW_STATUS_VALUES = Object.values(REVIEW_STATUS);

const reviewSchema = new Schema(
    {
        /* ── Relationships ─────────────────────────────────────── */
        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true,
            index: true,
        },
        student: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        // The enrollment that makes this review eligible (unique per student+course).
        enrollment: {
            type: Schema.Types.ObjectId,
            ref: "Enrollment",
            default: null,
        },

        /* ── Content ───────────────────────────────────────────── */
        rating: {
            type: Number,
            required: true,
            min: RATING.MIN,
            max: RATING.MAX,
            validate: {
                validator: (v) => Number.isInteger(v) && v >= RATING.MIN && v <= RATING.MAX,
                message: "Rating must be an integer between 1 and 5.",
            },
        },
        title: {
            type: String,
            trim: true,
            default: "",
            maxlength: 200,
        },
        comment: {
            type: String,
            trim: true,
            default: "",
            maxlength: 5000,
        },

        /* ── Moderation ────────────────────────────────────────── */
        status: {
            type: String,
            enum: REVIEW_STATUS_VALUES,
            default: REVIEW_STATUS.PENDING,
            index: true,
        },
        moderationNote: {
            type: String,
            trim: true,
            default: "",
        },
        moderatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        moderatedAt: {
            type: Date,
            default: null,
        },

        /* ── Soft delete ───────────────────────────────────────── */
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true, versionKey: false }
);

/* ── Indexes ─────────────────────────────────────────────────────────── */
// One active review per student+course (soft-deleted reviews excluded).
reviewSchema.index(
    { student: 1, course: 1 },
    { unique: true, partialFilterExpression: { deletedAt: null } }
);
// Approve-only listing: approved reviews for a course, newest first.
reviewSchema.index({ course: 1, status: 1, createdAt: -1 });
// Moderation queue.
reviewSchema.index({ status: 1, createdAt: -1 });

/* ── Soft-delete auto filter ─────────────────────────────────────────── */
reviewSchema.pre(/^find/, function () {
    this.where({ deletedAt: null });
});

const Review = model("Review", reviewSchema);

export default Review;
