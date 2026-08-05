/**
 * @file progress.model.js
 * @description Tracks a student's learning journey through an enrolled course.
 */

import mongoose from "mongoose";

import {
    PROGRESS_LIMITS,
    DEFAULT_PROGRESS,
} from "../constants/progress.constants.js";

const { Schema, model } = mongoose;

const progressSchema = new Schema(
    {
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

        totalTimeSpent: {
            type: Number,
            default: DEFAULT_PROGRESS.TOTAL_TIME_SPENT,
            min: 0,
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

progressSchema.index(
    { enrollment: 1 },
    { unique: true, name: "unique_progress_per_enrollment" }
);

progressSchema.index(
    { student: 1, course: 1 },
    { unique: true, name: "unique_student_course_progress" }
);

progressSchema.index({ student: 1 });
progressSchema.index({ course: 1 });
progressSchema.index({ student: 1, currentLesson: 1 });

progressSchema.index({ isCourseCompleted: 1 });
progressSchema.index({ student: 1, isCourseCompleted: 1 });

// Clamp percentage & keep completion fields consistent.
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

/** True while the learner is still progressing. */
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

/** Set the learner's current position (module + lesson); persist via save(). */
progressSchema.methods.touchLearningPosition = function (moduleId, lessonId) {
    this.currentModule = moduleId;
    this.currentLesson = lessonId;
    this.lastLesson = lessonId;
    return this;
};

/** Set the overall completion percentage (clamped 0–100); persist via save(). */
progressSchema.methods.updateCompletionPercentage = function (percentage) {
    this.completionPercentage = Math.min(
        PROGRESS_LIMITS.MAX_PERCENTAGE,
        Math.max(PROGRESS_LIMITS.MIN_PERCENTAGE, percentage)
    );
    return this;
};

/** Increment total learning time by the given seconds; persist via save(). */
progressSchema.methods.addTimeSpent = function (seconds = 0) {
    if (seconds > 0) {
        this.totalTimeSpent += seconds;
    }
    return this;
};

/** Whether the given lesson has been completed. */
progressSchema.methods.hasCompletedLesson = function (lessonId) {
    return this.completedLessons.some(
        (id) => id.toString() === lessonId.toString()
    );
};

/** Mark the course as completed (100 %, sets completedAt via the hook). */
progressSchema.methods.markCourseCompleted = function () {
    this.isCourseCompleted = true;
    this.completionPercentage = PROGRESS_LIMITS.MAX_PERCENTAGE;
    return this.save();
};

/** Query helper — filter to active (incomplete) progress. */
progressSchema.query.active = function () {
    return this.where({ isCourseCompleted: false });
};

/** Query helper — filter to completed progress. */
progressSchema.query.completed = function () {
    return this.where({ isCourseCompleted: true });
};

/** Look up a student's progress for a specific course. */
progressSchema.statics.findStudentCourseProgress = function (studentId, courseId) {
    return this.findOne({ student: studentId, course: courseId });
};

const Progress = model("Progress", progressSchema);

export default Progress;