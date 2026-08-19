/**
 * @file notification.constants.js
 * @description Constants for the LearnX notification system.
 */

/**
 * Notification category buckets (used for grouping + preference toggles).
 */
const NOTIFICATION_CATEGORIES = Object.freeze({
    COURSE: "course",
    ENROLLMENT: "enrollment",
    PAYMENT: "payment",
    QUIZ: "quiz",
    TASK: "task",
    REVIEW: "review",
    SYSTEM: "system",
});

/**
 * Notification types. Each maps to a category and a human title template.
 */
const NOTIFICATION_TYPES = Object.freeze({
    COURSE_PUBLISHED: "course_published",
    COURSE_ENROLLED: "course_enrolled",
    PAYMENT_COMPLETED: "payment_completed",
    PAYMENT_REFUNDED: "payment_refunded",
    QUIZ_RESULT: "quiz_result",
    TASK_EVALUATED: "task_evaluated",
    REVIEW_RECEIVED: "review_received",
    REVIEW_MODERATED: "review_moderated",
    NEW_ANNOUNCEMENT: "new_announcement",
    CERTIFICATE_ISSUED: "certificate_issued",
    SYSTEM: "system",
});

/**
 * Mapping of each notification type -> its category (for preferences).
 */
const NOTIFICATION_TYPE_CATEGORY = Object.freeze({
    [NOTIFICATION_TYPES.COURSE_PUBLISHED]: NOTIFICATION_CATEGORIES.COURSE,
    [NOTIFICATION_TYPES.COURSE_ENROLLED]: NOTIFICATION_CATEGORIES.ENROLLMENT,
    [NOTIFICATION_TYPES.PAYMENT_COMPLETED]: NOTIFICATION_CATEGORIES.PAYMENT,
    [NOTIFICATION_TYPES.PAYMENT_REFUNDED]: NOTIFICATION_CATEGORIES.PAYMENT,
    [NOTIFICATION_TYPES.QUIZ_RESULT]: NOTIFICATION_CATEGORIES.QUIZ,
    [NOTIFICATION_TYPES.TASK_EVALUATED]: NOTIFICATION_CATEGORIES.TASK,
    [NOTIFICATION_TYPES.REVIEW_RECEIVED]: NOTIFICATION_CATEGORIES.REVIEW,
    [NOTIFICATION_TYPES.REVIEW_MODERATED]: NOTIFICATION_CATEGORIES.REVIEW,
    [NOTIFICATION_TYPES.NEW_ANNOUNCEMENT]: NOTIFICATION_CATEGORIES.COURSE,
    [NOTIFICATION_TYPES.CERTIFICATE_ISSUED]: NOTIFICATION_CATEGORIES.COURSE,
    [NOTIFICATION_TYPES.SYSTEM]: NOTIFICATION_CATEGORIES.SYSTEM,
});

/**
 * Notification type labels (used for display + templates).
 */
const NOTIFICATION_TYPE_LABELS = Object.freeze({
    [NOTIFICATION_TYPES.COURSE_PUBLISHED]: "Course Published",
    [NOTIFICATION_TYPES.COURSE_ENROLLED]: "Course Enrollment",
    [NOTIFICATION_TYPES.PAYMENT_COMPLETED]: "Payment Completed",
    [NOTIFICATION_TYPES.PAYMENT_REFUNDED]: "Refund",
    [NOTIFICATION_TYPES.QUIZ_RESULT]: "Quiz Result",
    [NOTIFICATION_TYPES.TASK_EVALUATED]: "Task Evaluated",
    [NOTIFICATION_TYPES.REVIEW_RECEIVED]: "New Review",
    [NOTIFICATION_TYPES.REVIEW_MODERATED]: "Review Update",
    [NOTIFICATION_TYPES.NEW_ANNOUNCEMENT]: "Announcement",
    [NOTIFICATION_TYPES.CERTIFICATE_ISSUED]: "Certificate Issued",
    [NOTIFICATION_TYPES.SYSTEM]: "System",
});

export {
    NOTIFICATION_CATEGORIES,
    NOTIFICATION_TYPES,
    NOTIFICATION_TYPE_CATEGORY,
    NOTIFICATION_TYPE_LABELS,
};
