/**
 * @file review.service.js
 * @description Course review/rating service for the LearnX marketplace.
 *
 * Handles review CRUD, review eligibility (must have an active/completed
 * enrollment; one review per student+course), moderation (PENDING -> APPROVED
 * / REJECTED / FLAGGED), and — critically — keeping the course statistics in
 * sync:
 *
 *   course.statistics.totalReviews
 *   course.statistics.averageRating
 *   course.statistics.ratingDistribution { 1..5 }
 *
 * Only APPROVED, non-deleted reviews are counted. Every create/update/delete
 * and every moderation transition that affects an APPROVED review triggers a
 * recompute of the course stats so the numbers are always consistent.
 */

import mongoose from "mongoose";

import Review from "../models/review.model.js";
import Course from "../models/course.model.js";
import Enrollment from "../models/enrollment.model.js";

import {
    REVIEW_STATUS,
    REVIEW_STATUS_COUNTS,
    RATING,
} from "../constants/review.constants.js";
import { ENROLLMENT_STATUS } from "../constants/enrollment.constants.js";

import {
    NotFoundError,
    BadRequestError,
    ConflictError,
    ForbiddenError,
} from "../errors/index.js";
import logger from "../config/logger.js";
import { notifyUser } from "./notification.service.js";
import { NOTIFICATION_TYPES } from "../constants/notification.constants.js";

const { Types } = mongoose;

/* ────────────────────────────────────────────────────────────────────── */
/*  Public API                                                           */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Create a review for a course.
 *
 * Eligibility:
 *   - the course must exist;
 *   - the student must have an ACTIVE or COMPLETED enrollment;
 *   - the student must not already have a (non-deleted) review for the course.
 *
 * New reviews start as PENDING (moderation). Course stats are unaffected
 * until the review is approved.
 */
export const createReview = async ({ studentId, courseId, data }) => {
    // Eligibility: existing active/completed enrollment.
    const enrollment = await _findEligibleEnrollment(studentId, courseId);
    if (!enrollment) {
        throw new BadRequestError(
            "You must be enrolled in this course to leave a review."
        );
    }
    if (![ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED].includes(enrollment.status)) {
        throw new BadRequestError(
            "Only active or completed enrollments are eligible to review."
        );
    }

    // One review per student + course.
    const existing = await Review.findOne({
        student: studentId,
        course: courseId,
        deletedAt: null,
    });
    if (existing) {
        throw new ConflictError("You have already reviewed this course.");
    }

    const rating = _validateRating(data.rating);
    const review = await Review.create({
        course: courseId,
        student: studentId,
        enrollment: enrollment._id,
        rating,
        title: data.title || "",
        comment: data.comment || "",
        status: REVIEW_STATUS.PENDING,
    });

    logger.info(`Review created (${review._id}) for course ${courseId}`);

    // Notify the course instructor that a new review was submitted (pending
    // moderation). Best effort — never throw if the course/instructor lookup fails.
    try {
        const course = await Course.findById(courseId).select("instructor title");
        const instructor = course?.instructor;
        if (instructor) {
            await notifyUser({
                recipient: instructor,
                type: NOTIFICATION_TYPES.REVIEW_RECEIVED,
                title: "New review received",
                body: `A student rated "${course.title || "your course"}" ${rating}/5 and it's pending approval.`,
                data: { course: courseId, review: review._id, rating },
                actor: studentId,
            });
        }
    } catch (e) {
        logger.warn("Failed to notify course instructor of new review.", { error: e.message });
    }

    return review;
};

/**
 * Update a review's content/rating.
 *
 * Only the owner (or an admin) may update. If the review was APPROVED and its
 * rating changed (or it is being un-hidden after moderation), the course stats
 * are recomputed.
 */
export const updateReview = async ({ reviewId, user, data }) => {
    const review = await _getReview(reviewId);

    if (user.role !== "admin" && review.student.toString() !== user._id.toString()) {
        throw new ForbiddenError("You can only edit your own review.");
    }

    const wasCounted = REVIEW_STATUS_COUNTS[review.status] === true;

    if (data.rating !== undefined) {
        review.rating = _validateRating(data.rating);
    }
    if (data.title !== undefined) review.title = data.title || "";
    if (data.comment !== undefined) review.comment = data.comment || "";

    await review.save();

    if (wasCounted) {
        await _recomputeCourseStats(review.course);
    }

    return review;
};

/**
 * Soft-delete a review (owner or admin).
 */
export const deleteReview = async ({ reviewId, user }) => {
    const review = await _getReview(reviewId);

    if (user.role !== "admin" && review.student.toString() !== user._id.toString()) {
        throw new ForbiddenError("You can only delete your own review.");
    }

    const wasCounted = REVIEW_STATUS_COUNTS[review.status] === true;

    review.deletedAt = new Date();
    await review.save();

    if (wasCounted) {
        await _recomputeCourseStats(review.course);
    }

    return { deleted: true, reviewId };
};

/**
 * Get a student's own review for a course.
 */
export const getMyReview = async ({ studentId, courseId }) => {
    const review = await Review.findOne({
        student: studentId,
        course: courseId,
        deletedAt: null,
    });
    return review || null;
};

/**
 * List approved reviews for a course (public), newest first, with pagination.
 */
export const getCourseReviews = async ({ courseId, page = 1, limit = 10 }) => {
    const filter = { course: courseId, status: REVIEW_STATUS.APPROVED, deletedAt: null };
    const [reviews, total] = await Promise.all([
        Review.find(filter)
            .populate("student", "username name avatar")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Review.countDocuments(filter),
    ]);
    return {
        reviews,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Rating summary + distribution for a course (approved only).
 */
export const getCourseRatingSummary = async ({ courseId }) => {
    const course = await Course.findById(courseId).select("statistics title slug");
    if (!course) throw new NotFoundError("Course not found");
    return {
        averageRating: course.statistics?.averageRating || 0,
        totalReviews: course.statistics?.totalReviews || 0,
        ratingDistribution: course.statistics?.ratingDistribution || {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
        },
    };
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Moderation (admin/instructor)                                         */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Admin moderation queue (optionally filtered by status).
 */
export const getModerationQueue = async ({ page = 1, limit = 10, status }) => {
    const filter = { deletedAt: null };
    if (status && Object.values(REVIEW_STATUS).includes(status)) {
        filter.status = status;
    }
    const [reviews, total] = await Promise.all([
        Review.find(filter)
            .populate("student", "username name email")
            .populate("course", "title slug")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Review.countDocuments(filter),
    ]);
    return {
        reviews,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Moderate a review: APPROVE / REJECT / FLAG.
 * Approving counts the review toward course stats; rejecting/flagging
 * uncounts it (if it was previously counted).
 */
export const moderateReview = async ({ reviewId, status, moderator, note = "" }) => {
    if (!Object.values(REVIEW_STATUS).includes(status)) {
        throw new BadRequestError("Invalid review status.");
    }

    const review = await _getReview(reviewId);
    const wasCounted = REVIEW_STATUS_COUNTS[review.status] === true;
    const nowCounted = REVIEW_STATUS_COUNTS[status] === true;

    review.status = status;
    review.moderationNote = note || review.moderationNote;
    review.moderatedBy = moderator._id;
    review.moderatedAt = new Date();
    await review.save();

    // Only recompute if the counted-state changed (e.g. PENDING->APPROVED,
    // APPROVED->REJECTED, APPROVED->FLAGGED).
    if (wasCounted !== nowCounted) {
        await _recomputeCourseStats(review.course);
    }

    // Notify the student author of the moderation outcome.
    if (review.student) {
        const titleByStatus = {
            [REVIEW_STATUS.APPROVED]: "Your review is live",
            [REVIEW_STATUS.REJECTED]: "Your review was not approved",
            [REVIEW_STATUS.FLAGGED]: "Your review was flagged",
        };
        await notifyUser({
            recipient: review.student,
            type: NOTIFICATION_TYPES.REVIEW_MODERATED,
            title: titleByStatus[status] || "Review update",
            body:
                status === REVIEW_STATUS.APPROVED
                    ? "Your review has been approved and is now visible on the course."
                    : status === REVIEW_STATUS.REJECTED
                        ? "Unfortunately your review was not approved."
                        : "Your review is currently under review.",
            data: { course: review.course, review: review._id, status },
        }).catch(() => {});
    }

    return review;
};

/**
 * Admin: moderate multiple reviews at once (bulk approve/reject).
 */
export const bulkModerateReviews = async ({ reviewIds, status, moderator, note = "" }) => {
    if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
        throw new BadRequestError("reviewIds must be a non-empty array.");
    }
    const results = [];
    for (const id of reviewIds) {
        try {
            results.push(await moderateReview({ reviewId: id, status, moderator, note }));
        } catch (e) {
            results.push({ _id: id, error: e.message });
        }
    }
    return results;
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Private helpers                                                       */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Find an enrollment that makes the student eligible to review a course.
 */
const _findEligibleEnrollment = async (studentId, courseId) => {
    const course = await Course.findById(courseId).select("_id");
    if (!course) throw new NotFoundError("Course not found");

    return Enrollment.findOne({
        student: studentId,
        course: courseId,
        status: { $in: [ENROLLMENT_STATUS.ACTIVE, ENROLLMENT_STATUS.COMPLETED] },
    });
};

const _getReview = async (reviewId) => {
    if (!Types.ObjectId.isValid(reviewId)) {
        throw new BadRequestError("Invalid review id.");
    }
    const review = await Review.findById(reviewId);
    if (!review || review.deletedAt) {
        throw new NotFoundError("Review not found");
    }
    return review;
};

const _validateRating = (rating) => {
    const n = Number(rating);
    if (!Number.isInteger(n) || n < RATING.MIN || n > RATING.MAX) {
        throw new BadRequestError(`Rating must be an integer between ${RATING.MIN} and ${RATING.MAX}.`);
    }
    return n;
};

/**
 * Recompute a course's review statistics from its APPROVED, non-deleted
 * reviews, and persist them to the course document.
 */
const _recomputeCourseStats = async (courseId) => {
    const agg = await Review.aggregate([
        {
            $match: {
                course: new Types.ObjectId(String(courseId)),
                status: REVIEW_STATUS.APPROVED,
                deletedAt: null,
            },
        },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                total: { $sum: "$rating" },
                dist: { $push: "$rating" },
            },
        },
    ]);

    const row = agg[0];
    const count = row ? row.count : 0;
    const total = row ? row.total : 0;
    const averageRating = count > 0 ? Math.round((total / count) * 100) / 100 : 0;

    // Distribution keyed 5..1.
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (row) {
        for (const r of row.dist) {
            distribution[r] = (distribution[r] || 0) + 1;
        }
    }

    await Course.updateOne(
        { _id: courseId },
        {
            $set: {
                "statistics.totalReviews": count,
                "statistics.averageRating": averageRating,
                "statistics.ratingDistribution": distribution,
            },
        }
    );

    logger.info(
        `Course ${courseId} review stats recomputed: avg=${averageRating} count=${count}`
    );
    return { count, averageRating, distribution };
};
