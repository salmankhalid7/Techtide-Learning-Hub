/**
 * @file review.controller.js
 * @description Controllers for the LearnX course review/rating system.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";

import {
    createReview as createReviewService,
    updateReview as updateReviewService,
    deleteReview as deleteReviewService,
    getMyReview as getMyReviewService,
    getCourseReviews as getCourseReviewsService,
    getCourseRatingSummary as getCourseRatingSummaryService,
    getModerationQueue as getModerationQueueService,
    moderateReview as moderateReviewService,
    bulkModerateReviews as bulkModerateReviewsService,
} from "../services/review.service.js";

/* ── Student: CRUD ─────────────────────────────────────────────────── */

/**
 * POST /courses/:courseId/reviews
 */
const createReview = asyncHandler(async (req, res) => {
    const review = await createReviewService({
        studentId: req.user._id,
        courseId: req.params.courseId,
        data: req.body,
    });
    return res.status(201).json(
        new ApiResponse(201, "Review submitted and pending approval.", review)
    );
});

/**
 * PATCH /reviews/:reviewId
 */
const updateReview = asyncHandler(async (req, res) => {
    const review = await updateReviewService({
        reviewId: req.params.reviewId,
        user: req.user,
        data: req.body,
    });
    return res.status(200).json(new ApiResponse(200, "Review updated.", review));
});

/**
 * DELETE /reviews/:reviewId
 */
const deleteReview = asyncHandler(async (req, res) => {
    const result = await deleteReviewService({
        reviewId: req.params.reviewId,
        user: req.user,
    });
    return res.status(200).json(new ApiResponse(200, "Review deleted.", result));
});

/**
 * GET /reviews/mine/course/:courseId
 */
const getMyReview = asyncHandler(async (req, res) => {
    const review = await getMyReviewService({
        studentId: req.user._id,
        courseId: req.params.courseId,
    });
    return res.status(200).json(
        new ApiResponse(200, "Your review fetched.", review)
    );
});

/**
 * GET /courses/:courseId/reviews  (public — approved only)
 */
const getCourseReviews = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const result = await getCourseReviewsService({
        courseId: req.params.courseId,
        page,
        limit,
    });
    return res.status(200).json(new ApiResponse(200, "Reviews fetched.", result));
});

/**
 * GET /courses/:courseId/rating  (public — summary + distribution)
 */
const getCourseRatingSummary = asyncHandler(async (req, res) => {
    const result = await getCourseRatingSummaryService({
        courseId: req.params.courseId,
    });
    return res.status(200).json(new ApiResponse(200, "Course rating fetched.", result));
});

/* ── Admin: moderation ─────────────────────────────────────────────── */

/**
 * GET /reviews/moderation
 */
const getModerationQueue = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const result = await getModerationQueueService({
        page,
        limit,
        status: req.query.status,
    });
    return res.status(200).json(new ApiResponse(200, "Moderation queue fetched.", result));
});

/**
 * PATCH /reviews/:reviewId/moderate   { status, note? }
 */
const moderateReview = asyncHandler(async (req, res) => {
    const review = await moderateReviewService({
        reviewId: req.params.reviewId,
        status: req.body.status,
        moderator: req.user,
        note: req.body.note,
    });
    return res.status(200).json(new ApiResponse(200, "Review moderated.", review));
});

/**
 * POST /reviews/moderate/bulk   { reviewIds, status, note? }
 */
const bulkModerateReviews = asyncHandler(async (req, res) => {
    const result = await bulkModerateReviewsService({
        reviewIds: req.body.reviewIds,
        status: req.body.status,
        moderator: req.user,
        note: req.body.note,
    });
    return res.status(200).json(new ApiResponse(200, "Bulk moderation applied.", result));
});

export {
    createReview,
    updateReview,
    deleteReview,
    getMyReview,
    getCourseReviews,
    getCourseRatingSummary,
    getModerationQueue,
    moderateReview,
    bulkModerateReviews,
};
