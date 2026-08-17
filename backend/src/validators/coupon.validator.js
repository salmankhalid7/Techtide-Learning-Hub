/**
 * @file coupon.validator.js
 * @description Validators for the LearnX coupon routes.
 */

import { body, param, query } from "express-validator";
import mongoose from "mongoose";

import {
    COUPON_DISCOUNT_TYPES,
    COUPON_USAGE_SCOPES,
    COUPON_STATUS,
} from "../constants/coupon.constants.js";

const isMongoId = (value) => mongoose.Types.ObjectId.isValid(value);

const createCouponValidator = [
    body("code").trim().notEmpty().withMessage("Coupon code is required.")
        .isLength({ max: 50 }).withMessage("Code too long."),
    body("discountType")
        .isIn(Object.values(COUPON_DISCOUNT_TYPES))
        .withMessage("Invalid discount type."),
    body("discountValue").isFloat({ min: 0 }).withMessage("Invalid discount value."),
    body("currency").optional().isString().isLength({ max: 10 }),
    body("description").optional().isString().isLength({ max: 500 }),
    body("courses").optional().isArray().withMessage("courses must be an array."),
    body("usageScope")
        .optional()
        .isIn(Object.values(COUPON_USAGE_SCOPES))
        .withMessage("Invalid usage scope."),
    body("maxUses").optional().isInt({ min: 0 }).withMessage("Invalid maxUses."),
    body("perUserLimit").optional().isInt({ min: 1 }).withMessage("Invalid perUserLimit."),
    body("startsAt").optional().isISO8601().withMessage("Invalid start date."),
    body("expiresAt").optional().isISO8601().withMessage("Invalid expiry date."),
];

const updateCouponValidator = [
    param("couponId").custom(isMongoId).withMessage("Invalid couponId."),
    body("discountType")
        .optional()
        .isIn(Object.values(COUPON_DISCOUNT_TYPES))
        .withMessage("Invalid discount type."),
    body("discountValue").optional().isFloat({ min: 0 }).withMessage("Invalid discount value."),
    body("currency").optional().isString().isLength({ max: 10 }),
    body("description").optional().isString().isLength({ max: 500 }),
    body("courses").optional().isArray().withMessage("courses must be an array."),
    body("usageScope")
        .optional()
        .isIn(Object.values(COUPON_USAGE_SCOPES))
        .withMessage("Invalid usage scope."),
    body("maxUses").optional().isInt({ min: 0 }).withMessage("Invalid maxUses."),
    body("perUserLimit").optional().isInt({ min: 1 }).withMessage("Invalid perUserLimit."),
    body("startsAt").optional().isISO8601().withMessage("Invalid start date."),
    body("expiresAt").optional().isISO8601().withMessage("Invalid expiry date."),
];

const getCouponValidator = [param("couponId").custom(isMongoId).withMessage("Invalid couponId.")];

const getCouponsValidator = [
    query("page").optional().isInt({ min: 1 }).withMessage("Invalid page."),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Invalid limit."),
    query("status")
        .optional()
        .isIn(Object.values(COUPON_STATUS))
        .withMessage("Invalid status."),
];

const validateCouponValidator = [
    body("code").trim().notEmpty().withMessage("Coupon code is required."),
    body("courseId").optional().custom(isMongoId).withMessage("Invalid courseId."),
];

const setCouponStatusValidator = [
    param("couponId").custom(isMongoId).withMessage("Invalid couponId."),
    body("status").isIn(Object.values(COUPON_STATUS)).withMessage("Invalid status."),
];

export {
    createCouponValidator,
    updateCouponValidator,
    getCouponValidator,
    getCouponsValidator,
    validateCouponValidator,
    setCouponStatusValidator,
};
