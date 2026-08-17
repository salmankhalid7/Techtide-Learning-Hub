/**
 * @file review.validator.js
 * @description Validators for the LearnX course review/rating routes.
 */

import { body, param, query } from "express-validator";
import mongoose from "mongoose";

import { REVIEW_STATUS, RATING } from "../constants/review.constants.js";

const isMongoId = (value) => mongoose.Types.ObjectId.isValid(value);

const courseIdRule = () => [
    param("courseId")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("Invalid courseId."),
];

const reviewIdRule = () => [
    param("reviewId")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("Invalid reviewId."),
];

const ratingRule = (field = "rating") =>
    body(field)
        .isInt({ min: RATING.MIN, max: RATING.MAX })
        .withMessage(`Rating must be an integer between ${RATING.MIN} and ${RATING.MAX}.`);

const paginationRule = () => [
    query("page").optional().isInt({ min: 1 }).withMessage("Invalid page."),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Invalid limit."),
];

/**
 * POST /courses/:courseId/reviews
 */
const createReviewValidator = [
    ...courseIdRule(),
    ratingRule("rating"),
    body("title").optional().trim().isLength({ max: 200 }).withMessage("Title too long."),
    body("comment").optional().trim().isLength({ max: 5000 }).withMessage("Comment too long."),
];

/**
 * PATCH /reviews/:reviewId
 */
const updateReviewValidator = [
    ...reviewIdRule(),
    ratingRule("rating").optional(),
    body("title").optional().trim().isLength({ max: 200 }).withMessage("Title too long."),
    body("comment").optional().trim().isLength({ max: 5000 }).withMessage("Comment too long."),
];

/**
 * DELETE /reviews/:reviewId
 */
const deleteReviewValidator = [...reviewIdRule()];

/**
 * GET /reviews/mine/course/:courseId
 */
const getMyReviewValidator = [...courseIdRule()];

/**
 * GET /courses/:courseId/reviews
 */
const getCourseReviewsValidator = [...courseIdRule(), ...paginationRule()];

/**
 * GET /courses/:courseId/rating
 */
const getCourseRatingSummaryValidator = [courseIdRule()];

/**
 * GET /reviews/moderation
 */
const getModerationQueueValidator = [
    ...paginationRule(),
    query("status")
        .optional()
        .isIn(Object.values(REVIEW_STATUS))
        .withMessage("Invalid status."),
];

/**
 * PATCH /reviews/:reviewId/moderate
 */
const moderateReviewValidator = [
    ...reviewIdRule(),
    body("status").isIn(Object.values(REVIEW_STATUS)).withMessage("Invalid review status."),
    body("note").optional().trim().isLength({ max: 500 }),
];

/**
 * POST /reviews/moderate/bulk
 */
const bulkModerateReviewsValidator = [
    body("reviewIds").isArray({ min: 1 }).withMessage("reviewIds must be a non-empty array."),
    body("reviewIds.*").custom(isMongoId).withMessage("Invalid review id in list."),
    body("status").isIn(Object.values(REVIEW_STATUS)).withMessage("Invalid review status."),
    body("note").optional().trim().isLength({ max: 500 }),
];

export {
    createReviewValidator,
    updateReviewValidator,
    deleteReviewValidator,
    getMyReviewValidator,
    getCourseReviewsValidator,
    getCourseRatingSummaryValidator,
    getModerationQueueValidator,
    moderateReviewValidator,
    bulkModerateReviewsValidator,
};
