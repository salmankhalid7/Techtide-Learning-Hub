/**
 * @file task.model.js
 * @description Task/Assignment model for LearnX AI LMS.
 */

import mongoose from "mongoose";
import {
    TASK_STATUS,
    TASK_TYPES,
    TASK_DIFFICULTY,
    SUBMISSION_TYPES,
} from "../constants/task.constants.js";

const { Schema } = mongoose;

const TASK_STATUS_VALUES = Object.values(TASK_STATUS);
const TASK_TYPE_VALUES = Object.values(TASK_TYPES);
const TASK_DIFFICULTY_VALUES = Object.values(TASK_DIFFICULTY);
const SUBMISSION_TYPE_VALUES = Object.values(SUBMISSION_TYPES);

/**
 * Rubric criterion schema.
 */
const rubricSchema = new Schema(
    {
        criterion: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },

        description: {
            type: String,
            trim: true,
            default: "",
            maxlength: 1000,
        },

        maxPoints: {
            type: Number,
            required: true,
            min: 1,
        },

        order: {
            type: Number,
            required: true,
            min: 1,
        },
    },
    {
        _id: false,
    }
);

/**
 * Submission configuration.
 */
const submissionSettingsSchema = new Schema(
    {
        allowedTypes: {
            type: [String],
            enum: SUBMISSION_TYPE_VALUES,
            required: true,
            default: [SUBMISSION_TYPES.TEXT],
        },

        attemptLimit: {
            type: Number,
            min: 1,
            default: 1,
        },

        allowLateSubmission: {
            type: Boolean,
            default: false,
        },

        maxFileSize: {
            type: Number,
            min: 0,
            default: 10 * 1024 * 1024,
        },
    },
    {
        _id: false,
    }
);

/**
 * Main Task schema.
 */
const taskSchema = new Schema(
    {
        // ===========================
        // Relationships
        // ===========================

        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true,
            index: true,
        },

        module: {
            type: Schema.Types.ObjectId,
            ref: "Module",
            required: true,
            index: true,
        },

        lesson: {
            type: Schema.Types.ObjectId,
            ref: "Lesson",
            default: null,
        },

        instructor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // ===========================
        // Basic Information
        // ===========================

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },

        slug: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },

        description: {
            type: String,
            trim: true,
            default: "",
            maxlength: 2000,
        },

        instructions: {
            type: String,
            trim: true,
            default: "",
        },

        // ===========================
        // Task Configuration
        // ===========================

        taskType: {
            type: String,
            enum: TASK_TYPE_VALUES,
            required: true,
        },

        difficulty: {
            type: String,
            enum: TASK_DIFFICULTY_VALUES,
            default: TASK_DIFFICULTY.MEDIUM,
        },

        // ===========================
        // Scoring
        // ===========================

        maxScore: {
            type: Number,
            required: true,
            min: 1,
        },

        passingScore: {
            type: Number,
            required: true,
            min: 0,
        },

        rubric: {
            type: [rubricSchema],
            default: [],
        },

        // ===========================
        // Submission Configuration
        // ===========================

        submissionSettings: {
            type: submissionSettingsSchema,
            default: () => ({}),
        },

        // ===========================
        // Availability
        // ===========================

        dueDate: {
            type: Date,
            default: null,
        },

        // ===========================
        // Ordering
        // ===========================

        order: {
            type: Number,
            required: true,
            min: 1,
        },

        // ===========================
        // Lifecycle
        // ===========================

        status: {
            type: String,
            enum: TASK_STATUS_VALUES,
            default: TASK_STATUS.DRAFT,
            index: true,
        },

        publishedAt: {
            type: Date,
            default: null,
        },

        archivedAt: {
            type: Date,
            default: null,
        },

        // ===========================
        // Soft Delete
        // ===========================

        deletedAt: {
            type: Date,
            default: null,
        },

        // ===========================
        // Audit
        // ===========================

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

/**
 * ==========================================
 * Indexes
 * ==========================================
 */

// Course/module task lookup.
taskSchema.index({ course: 1, module: 1 });

// Instructor lookup.
taskSchema.index({ instructor: 1, status: 1 });

// Prevent duplicate ordering among active tasks.
taskSchema.index(
    { module: 1, order: 1 },
    {
        unique: true,
        partialFilterExpression: {
            deletedAt: null,
        },
    }
);

// Instructor-scoped unique slug.
taskSchema.index(
    { instructor: 1, slug: 1 },
    {
        unique: true,
    }
);

// Soft-delete queries.
taskSchema.index({ deletedAt: 1 });

// Due-date queries.
taskSchema.index({ dueDate: 1 });

// Text search.
taskSchema.index({
    title: "text",
    description: "text",
});

/**
 * ==========================================
 * Virtuals
 * ==========================================
 */

taskSchema.virtual("isPublished").get(function () {
    return this.status === TASK_STATUS.PUBLISHED;
});

taskSchema.virtual("isDeleted").get(function () {
    return this.deletedAt !== null;
});

taskSchema.virtual("isOverdue").get(function () {
    if (!this.dueDate) return false;

    return this.dueDate < new Date();
});

taskSchema.virtual("rubricTotalPoints").get(function () {
    return this.rubric.reduce(
        (total, criterion) => total + criterion.maxPoints,
        0
    );
});

/**
 * ==========================================
 * Middleware
 * ==========================================
 */

taskSchema.pre(/^find/, function () {
    this.where({ deletedAt: null });
});

/**
 * ==========================================
 * Instance Methods
 * ==========================================
 */

taskSchema.methods.isPublishedTask = function () {
    return this.status === TASK_STATUS.PUBLISHED;
};

taskSchema.methods.isDeletedTask = function () {
    return this.deletedAt !== null;
};

/**
 * ==========================================
 * Export
 * ==========================================
 */

const Task = mongoose.model("Task", taskSchema);

export default Task;