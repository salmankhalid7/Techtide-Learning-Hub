/**
 * @file coupon.controller.js
 * @description Coupon/discount-code controllers (admin management + public
 *              validation).
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";

import {
    createCoupon as createCouponService,
    getCoupon as getCouponService,
    getCoupons as getCouponsService,
    validateCoupon as validateCouponService,
    updateCoupon as updateCouponService,
    setCouponStatus as setCouponStatusService,
} from "../services/coupon.service.js";

const createCoupon = asyncHandler(async (req, res) => {
    const coupon = await createCouponService({ user: req.user, data: req.body });
    return res.status(201).json(new ApiResponse(201, "Coupon created.", coupon));
});

const getCoupon = asyncHandler(async (req, res) => {
    const coupon = await getCouponService({ couponId: req.params.couponId });
    return res.status(200).json(new ApiResponse(200, "Coupon fetched.", coupon));
});

const getCoupons = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const result = await getCouponsService({ page, limit, status: req.query.status });
    return res.status(200).json(new ApiResponse(200, "Coupons fetched.", result));
});

/**
 * POST /coupons/validate  (public — student checks a code before paying).
 */
const validateCoupon = asyncHandler(async (req, res) => {
    const coupon = await validateCouponService({
        code: req.body.code,
        courseId: req.body.courseId,
    });
    return res.status(200).json(new ApiResponse(200, "Coupon is valid.", coupon));
});

const updateCoupon = asyncHandler(async (req, res) => {
    const coupon = await updateCouponService({ couponId: req.params.couponId, data: req.body });
    return res.status(200).json(new ApiResponse(200, "Coupon updated.", coupon));
});

const setCouponStatus = asyncHandler(async (req, res) => {
    const coupon = await setCouponStatusService({
        couponId: req.params.couponId,
        status: req.body.status,
    });
    return res.status(200).json(new ApiResponse(200, "Coupon status updated.", coupon));
});

export {
    createCoupon,
    getCoupon,
    getCoupons,
    validateCoupon,
    updateCoupon,
    setCouponStatus,
};
