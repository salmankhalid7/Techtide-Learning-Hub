/**
 * @file task.constants.js
 * @description Constants for LearnX AI task/assignment system.
 */

/**
 * Task lifecycle status.
 */
const TASK_STATUS = Object.freeze({
    DRAFT: "DRAFT",
    PUBLISHED: "PUBLISHED",
    ARCHIVED: "ARCHIVED",
});

/**
 * Supported task types.
 */
const TASK_TYPES = Object.freeze({
    CODING: "CODING",
    WRITTEN: "WRITTEN",
    PROJECT: "PROJECT",
    FILE_UPLOAD: "FILE_UPLOAD",
    GENERAL: "GENERAL",
});

/**
 * Task difficulty levels.
 */
const TASK_DIFFICULTY = Object.freeze({
    EASY: "EASY",
    MEDIUM: "MEDIUM",
    HARD: "HARD",
});

/**
 * Supported submission types.
 */
const SUBMISSION_TYPES = Object.freeze({
    TEXT: "TEXT",
    CODE: "CODE",
    URL: "URL",
    FILE: "FILE",
});

/**
 * AI evaluation status.
 */
const AI_EVALUATION_STATUS = Object.freeze({
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    COMPLETED: "COMPLETED",
    FAILED: "FAILED",
});

/**
 * Task submission status.
 */
const TASK_SUBMISSION_STATUS = Object.freeze({
    DRAFT: "DRAFT",
    SUBMITTED: "SUBMITTED",
    EVALUATING: "EVALUATING",
    EVALUATED: "EVALUATED",
    GRADED: "GRADED",
});

/**
 * Export constants.
 */
export {
    TASK_STATUS,
    TASK_TYPES,
    TASK_DIFFICULTY,
    SUBMISSION_TYPES,
    AI_EVALUATION_STATUS,
    TASK_SUBMISSION_STATUS,
};