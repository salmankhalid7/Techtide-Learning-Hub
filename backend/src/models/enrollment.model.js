/**
 * @file enrollment.model.js
 * @description Enrollment model — tracks a student's enrolment in a course.
 */

import mongoose from "mongoose";

import { ENROLLMENT_STATUS } from "../constants/enrollment.constants.js";

const { Schema, model } = mongoose;

/* -------------------------------------------------------------------------- */
/*                                JSDoc Typedef                               */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} Enrollment
 * @property {mongoose.Types.ObjectId} student  — The enrolled user.
 * @property {mongoose.Types.ObjectId} course   — The course they enrolled in.
 * @property {"ACTIVE"|"COMPLETED"|"DROPPED"|"SUSPENDED"} status
 * @property {Date}        enrolledAt
 * @property {Date}        [completedAt]  — Only set when status is COMPLETED.
 * @property {Date}        [droppedAt]    — Only set when status is DROPPED.
 * @property {Date|null}   lastAccessedAt
 * @property {Object}      metadata
 * @property {Date}        createdAt      — Mongoose timestamp (auto).
 * @property {Date}        updatedAt      — Mongoose timestamp (auto).
 */

/* -------------------------------------------------------------------------- */
/*                                Schema                                      */
/* -------------------------------------------------------------------------- */

const enrollmentSchema = new Schema(
    {
        student: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },

        status: {
            type: String,
            enum: Object.values(ENROLLMENT_STATUS),
            default: ENROLLMENT_STATUS.ACTIVE,
        },

        enrolledAt: {
            type: Date,
            default: Date.now,
        },

        completedAt: {
            type: Date,
            default: null,
        },

        droppedAt: {
            type: Date,
            default: null,
        },

        lastAccessedAt: {
            type: Date,
            default: null,
        },

        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

/* -------------------------------------------------------------------------- */
/*                                  Indexes                                   */
/* -------------------------------------------------------------------------- */

// A student can only have one active enrolment per course
enrollmentSchema.index(
    { student: 1, course: 1, status: 1 },
    { unique: true, partialFilterExpression: { status: ENROLLMENT_STATUS.ACTIVE } }
);

// Instructor/admin lookups: all students enrolled in a given course
enrollmentSchema.index({ course: 1, status: 1 });

// Admin dashboards: filter by status
enrollmentSchema.index({ status: 1 });

/* -------------------------------------------------------------------------- */
/*                              Pre-Validate Hook                             */
/* -------------------------------------------------------------------------- */

/**
 * Ensures status-bound date fields are consistent:
 * - `completedAt` may only be set when status is COMPLETED.
 * - `droppedAt` may only be set when status is DROPPED.
 */
enrollmentSchema.pre("validate", function () {
    // completedAt ↔ COMPLETED
    if (this.status === ENROLLMENT_STATUS.COMPLETED && !this.completedAt) {
        this.completedAt = new Date();
    }
    if (this.status !== ENROLLMENT_STATUS.COMPLETED && this.completedAt) {
        this.completedAt = null;
    }

    // droppedAt ↔ DROPPED
    if (this.status === ENROLLMENT_STATUS.DROPPED && !this.droppedAt) {
        this.droppedAt = new Date();
    }
    if (this.status !== ENROLLMENT_STATUS.DROPPED && this.droppedAt) {
        this.droppedAt = null;
    }
});

/* -------------------------------------------------------------------------- */
/*                                 Virtuals                                   */
/* -------------------------------------------------------------------------- */

/**
 * Convenience getter — true when the enrolment is currently active.
 */
enrollmentSchema.virtual("isActive").get(function () {
    return this.status === ENROLLMENT_STATUS.ACTIVE;
});

/* -------------------------------------------------------------------------- */
/*                              Instance Methods                              */
/* -------------------------------------------------------------------------- */

/**
 * Mark the enrolment as completed.
 * Sets status → COMPLETED and records the completion timestamp.
 * @returns {Promise<Enrollment>}
 */
enrollmentSchema.methods.markCompleted = function () {
    this.status = ENROLLMENT_STATUS.COMPLETED;
    this.completedAt = new Date();
    return this.save();
};

/**
 * Drop the enrolment.
 * Sets status → DROPPED and records the drop timestamp.
 * @returns {Promise<Enrollment>}
 */
enrollmentSchema.methods.drop = function () {
    this.status = ENROLLMENT_STATUS.DROPPED;
    this.droppedAt = new Date();
    return this.save();
};

/**
 * Update the last-accessed timestamp to now.
 * Does **not** trigger a full save — uses `updateOne` for performance.
 * @returns {Promise<Query>}
 */
enrollmentSchema.methods.touch = function () {
    this.lastAccessedAt = new Date();
    return this.save({ validateBeforeSave: false });
};

/* -------------------------------------------------------------------------- */
/*                                  Export                                    */
/* -------------------------------------------------------------------------- */

export default model("Enrollment", enrollmentSchema);
