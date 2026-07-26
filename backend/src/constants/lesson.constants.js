/**
 * @file lesson.constants.js
 * @description Lesson-related constants for LearnX AI LMS.
 */

export const LESSON_TYPES = Object.freeze([
    "VIDEO",
    "TEXT",
    "PDF",
    "EXTERNAL_LINK",
    "AUDIO",
    "LIVE_SESSION"
]);

export const LESSON_STATUS = Object.freeze([
    "DRAFT",
    "PUBLISHED",
    "ARCHIVED"
]);

export const LESSON_STATUS_ENUM = Object.freeze({
    DRAFT: "DRAFT",
    PUBLISHED: "PUBLISHED",
    ARCHIVED: "ARCHIVED",
});
