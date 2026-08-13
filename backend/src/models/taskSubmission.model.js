/**
 * @file taskSubmission.model.js
 * @description Student submission + AI evaluation model for LearnX AI LMS
 * tasks/assignments.
 */

import mongoose from "mongoose";
import {
    SUBMISSION_TYPES,
    AI_EVALUATION_STATUS,
    TASK_SUBMISSION_STATUS,
} from "../constants/task.constants.js";

const { Schema, model } = mongoose;

const SUBMISSION_TYPE_VALUES = Object.values(SUBMISSION_TYPES);
const AI_EVALUATION_STATUS_VALUES = Object.values(AI_EVALUATION_STATUS);
const TASK_SUBMISSION_STATUS_VALUES = Object.values(TASK_SUBMISSION_STATUS);

/**
 * An attachment uploaded by a student as part of a submission.
 */
const attachmentSchema = new Schema(
    {
        type: {
            type: String,
            enum: SUBMISSION_TYPE_VALUES,
            default: SUBMISSION_TYPES.FILE,
        },

        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255,
        },

        url: {
            type: String,
            required: true,
            trim: true,
        },

        publicId: {
            type: String,
            default: null,
            trim: true,
        },

        size: {
            type: Number,
            default: 0,
            min: 0,
        },

        mimeType: {
            type: String,
            default: "",
            trim: true,
        },
    },
    { _id: false }
);

/**
 * The student-submitted content for a single attempt.
 * Only the field(s) relevant to the submission type are populated.
 *
 * - TEXT / WRITTEN  -> `textContent`
 * - CODE            -> `codeContent` + `codeLanguage`
 * - URL             -> `url`
 * - FILE            -> `attachments[]`
 */
const submissionContentSchema = new Schema(
    {
        textContent: {
            type: String,
            trim: true,
            default: "",
        },

        codeContent: {
            type: String,
            trim: true,
            default: "",
        },

        codeLanguage: {
            type: String,
            trim: true,
            default: "",
        },

        url: {
            type: String,
            trim: true,
            default: "",
        },

        attachments: {
            type: [attachmentSchema],
            default: [],
        },
    },
    { _id: false }
);

/**
 * A single rubric-criterion score produced by the AI evaluator
 * (or overridden by the instructor during regrade).
 */
const rubricResultSchema = new Schema(
    {
        criterion: {
            type: String,
            required: true,
            trim: true,
        },

        maxPoints: {
            type: Number,
            required: true,
            min: 0,
        },

        awardedPoints: {
            type: Number,
            default: 0,
            min: 0,
        },

        comment: {
            type: String,
            trim: true,
            default: "",
        },
    },
    { _id: false }
);

/**
 * The AI evaluation result attached to a graded submission.
 */
const aiEvaluationSchema = new Schema(
    {
        status: {
            type: String,
            enum: AI_EVALUATION_STATUS_VALUES,
            default: AI_EVALUATION_STATUS.PENDING,
        },

        score: {
            type: Number,
            default: 0,
            min: 0,
        },

        maxScore: {
            type: Number,
            default: 0,
            min: 0,
        },

        percentage: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },

        rubricResults: {
            type: [rubricResultSchema],
            default: [],
        },

        feedback: {
            type: String,
            trim: true,
            default: "",
        },

        strengths: {
            type: [String],
            default: [],
        },

        improvements: {
            type: [String],
            default: [],
        },

        confidence: {
            type: Number,
            default: 0,
            min: 0,
            max: 1,
        },

        model: {
            type: String,
            trim: true,
            default: "",
        },

        evaluatedAt: {
            type: Date,
            default: null,
        },

        error: {
            type: String,
            trim: true,
            default: "",
        },
    },
    { _id: false }
);

/**
 * Instructor override / regrade result.
 */
const regradeSchema = new Schema(
    {
        score: {
            type: Number,
            default: null,
            min: 0,
        },

        feedback: {
            type: String,
            trim: true,
            default: "",
        },

        comment: {
            type: String,
            trim: true,
            default: "",
        },

        regradedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        regradedAt: {
            type: Date,
            default: null,
        },
    },
    { _id: false }
);

/**
 * Main TaskSubmission schema.
 */
const taskSubmissionSchema = new Schema(
    {
        // ===========================
        // Relationships
        // ===========================

        task: {
            type: Schema.Types.ObjectId,
            ref: "Task",
            required: true,
            index: true,
        },

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

        student: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        enrollment: {
            type: Schema.Types.ObjectId,
            ref: "Enrollment",
            default: null,
        },

        instructor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        // ===========================
        // Submission
        // ===========================

        attemptNumber: {
            type: Number,
            required: true,
            min: 1,
        },

        content: {
            type: submissionContentSchema,
            default: () => ({}),
        },

        submittedAt: {
            type: Date,
            default: null,
        },

        isLate: {
            type: Boolean,
            default: false,
        },

        status: {
            type: String,
            enum: TASK_SUBMISSION_STATUS_VALUES,
            default: TASK_SUBMISSION_STATUS.DRAFT,
            index: true,
        },

        // ===========================
        // Grading
        // ===========================

        aiEvaluation: {
            type: aiEvaluationSchema,
            default: () => ({}),
        },

        regrade: {
            type: regradeSchema,
            default: () => ({}),
        },

        finalScore: {
            type: Number,
            default: null,
            min: 0,
        },

        finalPercentage: {
            type: Number,
            default: null,
            min: 0,
            max: 100,
        },

        isPassed: {
            type: Boolean,
            default: null,
        },

        gradedAt: {
            type: Date,
            default: null,
        },

        gradedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        // ===========================
        // Audit
        // ===========================

        deletedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

/* ------------------------------------------------------------------ */
/* Indexes                                                             */
/* ------------------------------------------------------------------ */

// A student's submission history for a task, newest first.
taskSubmissionSchema.index({ task: 1, student: 1, attemptNumber: -1 });

// Instructor view of all submissions for a task.
taskSubmissionSchema.index({ task: 1, status: 1 });

// Due-date / late handling & course-wide analytics.
taskSubmissionSchema.index({ course: 1, student: 1 });

// Soft-delete filtering.
taskSubmissionSchema.index({ deletedAt: 1 });

/* ------------------------------------------------------------------ */
/* Query middleware                                                   */
/* ------------------------------------------------------------------ */

// Exclude soft-deleted submissions from all find queries.
taskSubmissionSchema.pre(/^find/, function () {
    this.where({ deletedAt: null });
});

/* ------------------------------------------------------------------ */
/* Virtuals                                                            */
/* ------------------------------------------------------------------ */

taskSubmissionSchema.virtual("isDeleted").get(function () {
    return this.deletedAt !== null;
});

taskSubmissionSchema.virtual("hasBeenSubmitted").get(function () {
    return (
        this.status !== TASK_SUBMISSION_STATUS.DRAFT &&
        Boolean(this.submittedAt)
    );
});

const TaskSubmission = model("TaskSubmission", taskSubmissionSchema);

export default TaskSubmission;
