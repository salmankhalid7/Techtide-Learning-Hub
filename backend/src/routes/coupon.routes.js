/**
 * @file coupon.routes.js
 * @description Routes for the LearnX coupon/discount-code system.
 */

import { Router } from "express";

import {
    createCoupon,
    getCoupon,
    getCoupons,
    validateCoupon,
    updateCoupon,
    setCouponStatus,
} from "../controllers/coupon.controller.js";

import {
    createCouponValidator,
    updateCouponValidator,
    getCouponValidator,
    getCouponsValidator,
    validateCouponValidator,
    setCouponStatusValidator,
} from "../validators/coupon.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

/* Public: student can validate a coupon code before checkout. */
router.post(
    "/coupons/validate",
    authenticate,
    authorize("student", "instructor", "admin"),
    validateCouponValidator,
    validate,
    validateCoupon
);

/* Admin: manage coupons. */
router.post(
    "/coupons",
    authenticate,
    authorize("admin"),
    createCouponValidator,
    validate,
    createCoupon
);

router.get(
    "/coupons",
    authenticate,
    authorize("admin"),
    getCouponsValidator,
    validate,
    getCoupons
);

router.get(
    "/coupons/:couponId",
    authenticate,
    authorize("admin"),
    getCouponValidator,
    validate,
    getCoupon
);

router.patch(
    "/coupons/:couponId",
    authenticate,
    authorize("admin"),
    updateCouponValidator,
    validate,
    updateCoupon
);

router.patch(
    "/coupons/:couponId/status",
    authenticate,
    authorize("admin"),
    setCouponStatusValidator,
    validate,
    setCouponStatus
);

export default router;
