/**
 * @file review.constants.js
 * @description Constants for the LearnX course review/rating system.
 */

/**
 * Review moderation status lifecycle.
 *
 * - PENDING   : submitted, awaiting approval (moderation).
 * - APPROVED  : visible to everyone; counted in course stats.
 * - REJECTED  : removed by moderation; not visible; NOT counted in stats.
 * - FLAGGED   : temporarily hidden pending moderator review.
 */
const REVIEW_STATUS = Object.freeze({
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    REJECTED: "REJECTED",
    FLAGGED: "FLAGGED",
});

/**
 * Whether a review status contributes to the course average/statistics.
 * Only APPROVED reviews are counted so moderation can hide ratings.
 */
const REVIEW_STATUS_COUNTS = Object.freeze({
    PENDING: false,
    APPROVED: true,
    REJECTED: false,
    FLAGGED: false,
});

/**
 * Allowed rating range (inclusive).
 */
const RATING = Object.freeze({
    MIN: 1,
    MAX: 5,
});

export {
    REVIEW_STATUS,
    REVIEW_STATUS_COUNTS,
    RATING,
};
