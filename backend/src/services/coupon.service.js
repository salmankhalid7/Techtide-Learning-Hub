/**
 * @file coupon.service.js
 * @description Coupon/discount code management for the LearnX marketplace.
 *
 * Admin creates, validates, updates, and (de)activates coupons. Coupons are
 * validated by the order service at checkout against scoped courses and usage
 * limits.
 */

import Coupon from "../models/coupon.model.js";

import {
    COUPON_DISCOUNT_TYPES,
    COUPON_USAGE_SCOPES,
    COUPON_STATUS,
} from "../constants/coupon.constants.js";

import { NotFoundError, BadRequestError, ConflictError } from "../errors/index.js";
import logger from "../config/logger.js";

/**
 * Create a coupon.
 */
export const createCoupon = async ({ user, data }) => {
    const code = String(data.code || "").trim().toUpperCase();
    if (!code) throw new BadRequestError("Coupon code is required.");

    const existing = await Coupon.findOne({ code });
    if (existing) {
        throw new ConflictError("A coupon with this code already exists.");
    }

    if (!Object.values(COUPON_DISCOUNT_TYPES).includes(data.discountType)) {
        throw new BadRequestError("Invalid discount type.");
    }
    if (data.discountType === "percentage" && (data.discountValue < 0 || data.discountValue > 100)) {
        throw new BadRequestError("Percentage discount must be between 0 and 100.");
    }

    const coupon = await Coupon.create({
        code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        currency: data.currency || "USD",
        description: data.description || "",
        courses: data.courses || [],
        usageScope: data.usageScope || COUPON_USAGE_SCOPES.MULTI_USE,
        maxUses: data.maxUses ?? 0,
        perUserLimit: data.perUserLimit ?? 1,
        startsAt: data.startsAt || null,
        expiresAt: data.expiresAt || null,
        status: COUPON_STATUS.ACTIVE,
        createdBy: user._id,
    });

    return coupon;
};

/**
 * Get a single coupon by id.
 */
export const getCoupon = async ({ couponId }) => {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) throw new NotFoundError("Coupon not found");
    return coupon;
};

/**
 * List coupons with pagination + optional filters.
 */
export const getCoupons = async ({ page = 1, limit = 10, status }) => {
    const filter = {};
    if (status) filter.status = status;

    const [coupons, total] = await Promise.all([
        Coupon.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Coupon.countDocuments(filter),
    ]);

    return {
        coupons,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Validate a coupon code for a given course (does NOT consume it).
 * Returns the discount detail a student would receive.
 */
export const validateCoupon = async ({ code, courseId }) => {
    const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() });
    if (!coupon) throw new BadRequestError("Invalid coupon code.");
    if (coupon.status === "disabled") throw new BadRequestError("This coupon is not active.");

    const now = new Date();
    if (coupon.expiresAt && coupon.expiresAt < now) {
        throw new BadRequestError("This coupon has expired.");
    }
    if (coupon.startsAt && coupon.startsAt > now) {
        throw new BadRequestError("This coupon is not yet active.");
    }
    if (coupon.usageScope === "single_use" && coupon.redemptions >= 1) {
        throw new BadRequestError("This coupon has already been used.");
    }
    if (coupon.maxUses > 0 && coupon.redemptions >= coupon.maxUses) {
        throw new BadRequestError("This coupon has reached its usage limit.");
    }
    if (coupon.courses.length > 0 && courseId) {
        const scoped = coupon.courses.some((c) => c.toString() === courseId.toString());
        if (!scoped) throw new BadRequestError("This coupon does not apply to this course.");
    }

    return coupon;
};

/**
 * Update a coupon's metadata.
 */
export const updateCoupon = async ({ couponId, data }) => {
    const coupon = await Coupon.findById(couponId);
    if (!coupon) throw new NotFoundError("Coupon not found");

    const allowed = [
        "discountType",
        "discountValue",
        "currency",
        "description",
        "courses",
        "usageScope",
        "maxUses",
        "perUserLimit",
        "startsAt",
        "expiresAt",
        "status",
    ];
    for (const field of allowed) {
        if (data[field] !== undefined) coupon[field] = data[field];
    }

    await coupon.save();
    logger.info(`Coupon updated: ${coupon.code}`);
    return coupon;
};

/**
 * Toggle a coupon active/disabled.
 */
export const setCouponStatus = async ({ couponId, status }) => {
    if (!Object.values(COUPON_STATUS).includes(status)) {
        throw new BadRequestError("Invalid coupon status.");
    }
    const coupon = await Coupon.findById(couponId);
    if (!coupon) throw new NotFoundError("Coupon not found");
    coupon.status = status;
    await coupon.save();
    return coupon;
};
