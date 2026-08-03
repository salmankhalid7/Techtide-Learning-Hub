/**
 * @file attempt.constants.js
 * @description Constants for Quiz Attempt module.
 */

export const ATTEMPT_STATUS = Object.freeze({
    IN_PROGRESS: "IN_PROGRESS",
    SUBMITTED: "SUBMITTED",
    GRADING: "GRADING",
    GRADED: "GRADED",
    EXPIRED: "EXPIRED",
});

export const GRADING_METHOD = Object.freeze({
    AUTO: "AUTO",
    MANUAL: "MANUAL",
    AI: "AI",
});

export const SUBMISSION_REASON = Object.freeze({
    MANUAL: "MANUAL",
    TIME_EXPIRED: "TIME_EXPIRED",
    ADMIN_FORCE: "ADMIN_FORCE",
});

export const ANSWER_STATUS = Object.freeze({
    ANSWERED: "ANSWERED",
    UNANSWERED: "UNANSWERED",
});

export const AUTO_GRADABLE_QUESTION_TYPES = Object.freeze([
    "MULTIPLE_CHOICE_SINGLE",
    "MULTIPLE_CHOICE_MULTIPLE",
    "TRUE_FALSE",
    "FILL_IN_THE_BLANK",
]);