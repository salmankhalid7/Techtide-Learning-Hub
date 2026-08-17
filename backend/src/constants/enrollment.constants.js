/**
 * @file enrollment.constants.js
 * @description Constants for the Enrollment module.
 */

export const ENROLLMENT_STATUS = Object.freeze({
    ACTIVE: "ACTIVE",
    COMPLETED: "COMPLETED",
    DROPPED: "DROPPED",
    SUSPENDED: "SUSPENDED",
});

/**
 * How the student obtained access to the course.
 * - FREE : no payment (free course, or granted access).
 * - PAID : purchased through the marketplace payments flow.
 */
export const ENROLLMENT_TYPE = Object.freeze({
    FREE: "FREE",
    PAID: "PAID",
});
