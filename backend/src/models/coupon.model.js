/**
 * @file coupon.model.js
 * @description Coupon / discount code model for the LearnX marketplace.
 *
 * Coupons can be percentage- or fixed-amount discounts, scoped to a course
 * (or applied platform-wide when `courses` is empty), with an optional usage
 * limit, per-student limit, and expiry. `redemptions` counts total uses.
 */

import mongoose from "mongoose";

import {
    COUPON_DISCOUNT_TYPES,
    COUPON_USAGE_SCOPES,
    COUPON_STATUS,
} from "../constants/coupon.constants.js";

const { Schema, model } = mongoose;

const DISCOUNT_TYPE_VALUES = Object.values(COUPON_DISCOUNT_TYPES);
const USAGE_SCOPE_VALUES = Object.values(COUPON_USAGE_SCOPES);
const STATUS_VALUES = Object.values(COUPON_STATUS);

const couponSchema = new Schema(
    {
        code: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            unique: true,
        },

        discountType: {
            type: String,
            enum: DISCOUNT_TYPE_VALUES,
            required: true,
        },
        // Percentage (0-100) when discountType === "percentage";
        // fixed amount when discountType === "fixed".
        discountValue: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            trim: true,
            default: "USD",
        },

        description: {
            type: String,
            trim: true,
            default: "",
        },

        // Scope: empty array => applies to all courses.
        courses: {
            type: [Schema.Types.ObjectId],
            ref: "Course",
            default: [],
        },

        // Usage limits.
        usageScope: {
            type: String,
            enum: USAGE_SCOPE_VALUES,
            default: COUPON_USAGE_SCOPES.MULTI_USE,
        },
        maxUses: {
            type: Number,
            default: 0, // 0 = unlimited (when usageScope is multi_use)
            min: 0,
        },
        perUserLimit: {
            type: Number,
            default: 1,
            min: 1,
        },
        redemptions: {
            type: Number,
            default: 0,
            min: 0,
        },

        // Validity.
        startsAt: {
            type: Date,
            default: null,
        },
        expiresAt: {
            type: Date,
            default: null,
        },

        status: {
            type: String,
            enum: STATUS_VALUES,
            default: COUPON_STATUS.ACTIVE,
            index: true,
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true, versionKey: false }
);

// `code` has unique:true in the schema (creates the index); only add the
// status/expiry index here to avoid a duplicate index warning.
couponSchema.index({ status: 1, expiresAt: 1 });

const Coupon = model("Coupon", couponSchema);

export default Coupon;
