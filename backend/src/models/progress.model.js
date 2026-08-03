/**
 * @file progress.model.js
 * @description Tracks a student's learning journey through an enrolled course:
 *              current position, lesson/module completion, percentage, resume,
 *              and time-on-task.
 *
 * Business logic for enrollment, quizzes, certificates, analytics, and AI
 * recommendations belongs in the Service layer — not here.
 */

import mongoose from "mongoose";

import {
    PROGRESS_LIMITS,
    DEFAULT_PROGRESS,
} from "../constants/progress.constants.js";

const { Schema, model } = mongoose;

/* -------------------------------------------------------------------------- */
/*                                JSDoc Typedef                               */
/* -------------------------------------------------------------------------- */

/**
 * @typedef {Object} Progress
 *
 * @property {mongoose.Types.ObjectId}   enrollment           — Parent Enrollment doc.
 * @property {mongoose.Types.ObjectId}   student              — Enrolled student.
 * @property {mongoose.Types.ObjectId}   course               — Enrolled course.
 * @property {mongoose.Types.ObjectId|null} currentModule     — Module currently being studied.
 * @property {mongoose.Types.ObjectId|null} currentLesson     — Lesson currently being viewed.
 * @property {mongoose.Types.ObjectId|null} lastLesson        — Last lesson accessed.
 * @property {mongoose.Types.ObjectId[]} completedLessons     — Completed lesson IDs.
 * @property {mongoose.Types.ObjectId[]} completedModules     — Completed module IDs.
 * @property {number}                    completionPercentage — 0–100.
 * @property {number}                    totalTimeSpent       — Seconds spent learning.
 * @property {boolean}                   isCourseCompleted
 * @property {Date|null}                 completedAt
 * @property {Object}                    metadata             — Extensible payload.
 * @property {Date}                      createdAt            — Mongoose timestamp.
 * @property {Date}                      updatedAt            — Mongoose timestamp.
 */

/* -------------------------------------------------------------------------- */
/*                                  Schema                                    */
/* -------------------------------------------------------------------------- */

const progressSchema = new Schema(
    {
        // ── Relationships ──────────────────────────────────────────────

        enrollment: {
            type: Schema.Types.ObjectId,
            ref: "Enrollment",
            required: true,
            index: true,
        },

        student: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },

        // ── Current position ──────────────────────────────────────────

        currentModule: {
            type: Schema.Types.ObjectId,
            ref: "Module",
            default: null,
        },

        currentLesson: {
            type: Schema.Types.ObjectId,
            ref: "Lesson",
            default: null,
        },

        lastLesson: {
            type: Schema.Types.ObjectId,
            ref: "Lesson",
            default: null,
        },

        // ── Completion tracking ───────────────────────────────────────

        completedLessons: [
            {
                type: Schema.Types.ObjectId,
                ref: "Lesson",
            },
        ],

        completedModules: [
            {
                type: Schema.Types.ObjectId,
                ref: "Module",
            },
        ],

        completionPercentage: {
            type: Number,
            default: DEFAULT_PROGRESS.COMPLETION_PERCENTAGE,
            min: PROGRESS_LIMITS.MIN_PERCENTAGE,
            max: PROGRESS_LIMITS.MAX_PERCENTAGE,
        },

        isCourseCompleted: {
            type: Boolean,
            default: false,
        },

        completedAt: {
            type: Date,
            default: null,
        },

        // ── Metrics ──────────────────────────────────────────────────

        totalTimeSpent: {
            type: Number,
            default: DEFAULT_PROGRESS.TOTAL_TIME_SPENT,
            min: 0,
        },

        // ── Extensible payload ───────────────────────────────────────

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

// One progress doc per enrollment
progressSchema.index(
    { enrollment: 1 },
    { unique: true, name: "unique_progress_per_enrollment" }
);

// One progress doc per student–course pair
progressSchema.index(
    { student: 1, course: 1 },
    { unique: true, name: "unique_student_course_progress" }
);

// Student dashboard / course analytics / resume
progressSchema.index({ student: 1 });
progressSchema.index({ course: 1 });
progressSchema.index({ student: 1, currentLesson: 1 });

// Completion reporting
progressSchema.index({ isCourseCompleted: 1 });
progressSchema.index({ student: 1, isCourseCompleted: 1 });

/* -------------------------------------------------------------------------- */
/*                             Pre-Validate Hook                              */
/* -------------------------------------------------------------------------- */

/**
 * Keeps completion fields consistent:
 * - Clamps completionPercentage to 0–100.
 * - Sets completedAt when course is marked completed; clears it otherwise.
 */
progressSchema.pre("validate", function () {
    this.completionPercentage = Math.min(
        PROGRESS_LIMITS.MAX_PERCENTAGE,
        Math.max(PROGRESS_LIMITS.MIN_PERCENTAGE, this.completionPercentage)
    );

    if (this.isCourseCompleted && !this.completedAt) {
        this.completedAt = new Date();
    }

    if (!this.isCourseCompleted) {
        this.completedAt = null;
    }
});

/* -------------------------------------------------------------------------- */
/*                                  Virtuals                                  */
/* -------------------------------------------------------------------------- */

/** Whether the learner is still progressing (course not yet completed). */
progressSchema.virtual("isInProgress").get(function () {
    return !this.isCourseCompleted;
});

/** Number of completed lessons. */
progressSchema.virtual("completedLessonCount").get(function () {
    return this.completedLessons.length;
});

/** Number of completed modules. */
progressSchema.virtual("completedModuleCount").get(function () {
    return this.completedModules.length;
});

/* -------------------------------------------------------------------------- */
/*                             Instance Methods                               */
/* -------------------------------------------------------------------------- */

/**
 * Set the learner's current position (module + lesson).
 * Mutates in-memory only — caller must persist via save().
 * @param {mongoose.Types.ObjectId} moduleId
 * @param {mongoose.Types.ObjectId} lessonId
 * @returns {Progress}
 */
progressSchema.methods.touchLearningPosition = function (moduleId, lessonId) {
    this.currentModule = moduleId;
    this.currentLesson = lessonId;
    this.lastLesson = lessonId;
    return this;
};

/**
 * Set the overall completion percentage (clamped 0–100).
 * Mutates in-memory only — caller must persist via save().
 * @param {number} percentage
 * @returns {Progress}
 */
progressSchema.methods.updateCompletionPercentage = function (percentage) {
    this.completionPercentage = Math.min(
        PROGRESS_LIMITS.MAX_PERCENTAGE,
        Math.max(PROGRESS_LIMITS.MIN_PERCENTAGE, percentage)
    );
    return this;
};

/**
 * Increment total learning time by the given number of seconds.
 * Mutates in-memory only — caller must persist via save().
 * @param {number} seconds
 * @returns {Progress}
 */
progressSchema.methods.addTimeSpent = function (seconds = 0) {
    if (seconds > 0) {
        this.totalTimeSpent += seconds;
    }
    return this;
};

/**
 * Check whether a specific lesson has been completed.
 * @param {mongoose.Types.ObjectId|string} lessonId
 * @returns {boolean}
 */
progressSchema.methods.hasCompletedLesson = function (lessonId) {
    return this.completedLessons.some(
        (id) => id.toString() === lessonId.toString()
    );
};

/**
 * Mark the course as completed (100 %, sets completedAt via pre-validate hook).
 *
 * Final completion-validation belongs in the Service layer.
 * @returns {Promise<Progress>}
 */
progressSchema.methods.markCourseCompleted = function () {
    this.isCourseCompleted = true;
    this.completionPercentage = PROGRESS_LIMITS.MAX_PERCENTAGE;
    return this.save();
};

/* -------------------------------------------------------------------------- */
/*                               Query Helpers                                */
/* -------------------------------------------------------------------------- */

/** Query helper — filter to active (incomplete) progress. */
progressSchema.query.active = function () {
    return this.where({ isCourseCompleted: false });
};

/** Query helper — filter to completed progress. */
progressSchema.query.completed = function () {
    return this.where({ isCourseCompleted: true });
};

/* -------------------------------------------------------------------------- */
/*                               Static Methods                               */
/* -------------------------------------------------------------------------- */

/**
 * Look up a student's progress for a specific course.
 * @param {mongoose.Types.ObjectId} studentId
 * @param {mongoose.Types.ObjectId} courseId
 * @returns {Promise<Progress|null>}
 */
progressSchema.statics.findStudentCourseProgress = function (studentId, courseId) {
    return this.findOne({ student: studentId, course: courseId });
};

const Progress = model("Progress", progressSchema);

export default Progress;