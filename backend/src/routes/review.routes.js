/**
 * @file review.routes.js
 * @description Routes for the LearnX course review/rating system.
 */

import { Router } from "express";

import {
    createReview,
    updateReview,
    deleteReview,
    getMyReview,
    getCourseReviews,
    getCourseRatingSummary,
    getModerationQueue,
    moderateReview,
    bulkModerateReviews,
} from "../controllers/review.controller.js";

import {
    createReviewValidator,
    updateReviewValidator,
    deleteReviewValidator,
    getMyReviewValidator,
    getCourseReviewsValidator,
    getCourseRatingSummaryValidator,
    getModerationQueueValidator,
    moderateReviewValidator,
    bulkModerateReviewsValidator,
} from "../validators/review.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

/* ── Public (course reviews + rating summary) ──────────────────────── */
router.get(
    "/courses/:courseId/reviews",
    getCourseReviewsValidator,
    validate,
    getCourseReviews
);
router.get(
    "/courses/:courseId/rating",
    getCourseRatingSummaryValidator,
    validate,
    getCourseRatingSummary
);

/* ── Student: create, own review, update, delete ───────────────────── */
router.post(
    "/courses/:courseId/reviews",
    authenticate,
    authorize("student", "instructor", "admin"),
    createReviewValidator,
    validate,
    createReview
);
router.get(
    "/reviews/mine/course/:courseId",
    authenticate,
    authorize("student", "instructor", "admin"),
    getMyReviewValidator,
    validate,
    getMyReview
);
router.patch(
    "/reviews/:reviewId",
    authenticate,
    authorize("student", "instructor", "admin"),
    updateReviewValidator,
    validate,
    updateReview
);
router.delete(
    "/reviews/:reviewId",
    authenticate,
    authorize("student", "instructor", "admin"),
    deleteReviewValidator,
    validate,
    deleteReview
);

/* ── Admin: moderation ─────────────────────────────────────────────── */
router.get(
    "/reviews/moderation",
    authenticate,
    authorize("admin"),
    getModerationQueueValidator,
    validate,
    getModerationQueue
);
router.patch(
    "/reviews/:reviewId/moderate",
    authenticate,
    authorize("admin"),
    moderateReviewValidator,
    validate,
    moderateReview
);
router.post(
    "/reviews/moderate/bulk",
    authenticate,
    authorize("admin"),
    bulkModerateReviewsValidator,
    validate,
    bulkModerateReviews
);

export default router;
