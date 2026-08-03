/**
 * @file attempt.model.js
 * @description Quiz Attempt model.
 */

import mongoose from "mongoose";
import {
    ATTEMPT_STATUS,
    GRADING_METHOD,
    ANSWER_STATUS,
} from "../constants/attempt.constants.js";

const { Schema, model } = mongoose;

/* -------------------------------------------------------------------------- */
/*                            Question Snapshot                               */
/* -------------------------------------------------------------------------- */

const questionSnapshotSchema = new Schema(
    {
        questionId: {
            type: Schema.Types.ObjectId,
            ref: "Question",
            required: true,
        },

        questionText: {
            type: String,
            required: true,
            trim: true,
        },

        questionType: {
            type: String,
            required: true,
        },

        options: [
            {
                _id: false,
                optionId: { type: String, required: true },
                text: String,
            },
        ],

        correctAnswers: [Schema.Types.Mixed],

        marks: {
            type: Number,
            required: true,
            min: 0,
        },

        order: {
            type: Number,
            required: true,
        },
    },
    { _id: false }
);

/* -------------------------------------------------------------------------- */
/*                               Evaluation                                   */
/* -------------------------------------------------------------------------- */

const evaluationSchema = new Schema(
    {
        method: {
            type: String,
            enum: Object.values(GRADING_METHOD),
            default: GRADING_METHOD.AUTO,
        },

        confidence: {
            type: Number,
            default: 1,
            min: 0,
            max: 1,
        },

        reviewer: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        reviewedAt: Date,

        comments: [
            {
                type: String,
                trim: true,
            },
        ],
    },
    { _id: false }
);

/* -------------------------------------------------------------------------- */
/*                                  Answer                                    */
/* -------------------------------------------------------------------------- */

const answerSchema = new Schema(
    {
        question: {
            type: Schema.Types.ObjectId,
            ref: "Question",
            required: true,
        },

        snapshot: {
            type: questionSnapshotSchema,
            required: true,
        },

        selectedAnswers: {
            type: [Schema.Types.Mixed],
            default: [],
        },

        status: {
            type: String,
            enum: Object.values(ANSWER_STATUS),
            default: ANSWER_STATUS.UNANSWERED,
        },

        isCorrect: {
            type: Boolean,
            default: null,
        },

        marksAwarded: {
            type: Number,
            default: 0,
            min: 0,
        },

        timeSpent: {
            type: Number,
            default: 0,
            min: 0,
        },

        answeredAt: Date,

        feedback: {
            type: String,
            trim: true,
        },

        evaluation: {
            type: evaluationSchema,
            default: () => ({}),
        },
    },
    { _id: false }
);

/* -------------------------------------------------------------------------- */
/*                                 Summary                                    */
/* -------------------------------------------------------------------------- */

const summarySchema = new Schema(
    {
        totalQuestions: { type: Number, default: 0 },
        correctAnswers: { type: Number, default: 0 },
        incorrectAnswers: { type: Number, default: 0 },
        unansweredQuestions: { type: Number, default: 0 },
        objectiveQuestions: { type: Number, default: 0 },
        subjectiveQuestions: { type: Number, default: 0 },
    },
    { _id: false }
);

/* -------------------------------------------------------------------------- */
/*                               Quiz Attempt                                 */
/* -------------------------------------------------------------------------- */

const quizAttemptSchema = new Schema(
    {
        quiz: {
            type: Schema.Types.ObjectId,
            ref: "Quiz",
            required: true,
            index: true,
        },

        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },

        module: {
            type: Schema.Types.ObjectId,
            ref: "Module",
            required: true,
        },

        student: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        attemptNumber: {
            type: Number,
            required: true,
            min: 1,
        },

        status: {
            type: String,
            enum: Object.values(ATTEMPT_STATUS),
            default: ATTEMPT_STATUS.IN_PROGRESS,
            index: true,
        },

        startedAt: {
            type: Date,
            default: Date.now,
        },

        submittedAt: Date,

        timeLimit: {
            type: Number,
            required: true,
            min: 0,
        },

        answers: {
            type: [answerSchema],
            default: [],
        },

        totalMarks: {
            type: Number,
            default: 0,
        },

        obtainedMarks: {
            type: Number,
            default: 0,
        },

        percentage: {
            type: Number,
            default: 0,
        },

        passPercentage: {
            type: Number,
            required: true,
            min: 0,
            max: 100,
        },

        passed: {
            type: Boolean,
            default: false,
        },

        summary: {
            type: summarySchema,
            default: () => ({}),
        },

        metadata: {
            browser: String,
            device: String,
            ip: String,
            userAgent: String,
            submissionReason: String,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

/* -------------------------------------------------------------------------- */
/*                                  Indexes                                   */
/* -------------------------------------------------------------------------- */

quizAttemptSchema.index(
    { student: 1, quiz: 1, attemptNumber: 1 },
    { unique: true }
);

quizAttemptSchema.index({ student: 1, quiz: 1, status: 1 });

quizAttemptSchema.index({ quiz: 1, student: 1 });

quizAttemptSchema.index({ course: 1, student: 1 });

quizAttemptSchema.index({ submittedAt: -1 });

export default model("QuizAttempt", quizAttemptSchema);