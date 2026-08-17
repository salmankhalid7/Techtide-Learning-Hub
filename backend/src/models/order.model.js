/**
 * @file order.model.js
 * @description Order model for the LearnX marketplace.
 *
 * Represents a checkout/purchase of one or more courses by a student. An order
 * carries the price snapshot (so late price changes never alter a completed
 * transaction), the applied coupon, the payment attempt, and granted
 * enrollment. Every mutation of a paid order is recorded in `events` for a
 * full, audit-safe lifecycle.
 */

import mongoose from "mongoose";

import { ORDER_STATUS, ORDER_ITEM_TYPES } from "../constants/order.constants.js";
import { CURRENCIES } from "../constants/payment.constants.js";

const { Schema, model } = mongoose;

const ORDER_STATUS_VALUES = Object.values(ORDER_STATUS);
const ORDER_ITEM_TYPE_VALUES = Object.values(ORDER_ITEM_TYPES);
const CURRENCY_VALUES = Object.values(CURRENCIES);

/**
 * A single line item on the order (one course).
 * The `price` snapshot is captured at checkout time.
 */
const orderItemSchema = new Schema(
    {
        itemType: {
            type: String,
            enum: ORDER_ITEM_TYPE_VALUES,
            default: ORDER_ITEM_TYPES.COURSE,
        },
        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true,
        },
        courseTitle: {
            type: String,
            trim: true,
            default: "",
        },
        instructor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            default: 1,
        },
    },
    { _id: false }
);

/**
 * Money breakdown of the order.
 *
 * subtotal  = sum of item unit prices.
 * discount  = coupon discount applied.
 * total     = subtotal - discount (amount actually charged).
 */
const moneySchema = new Schema(
    {
        currency: {
            type: String,
            enum: CURRENCY_VALUES,
            required: true,
        },
        subtotal: {
            type: Number,
            required: true,
            min: 0,
        },
        discount: {
            type: Number,
            default: 0,
            min: 0,
        },
        total: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    { _id: false }
);

/**
 * Coupon applied to this order (snapshot).
 */
const appliedCouponSchema = new Schema(
    {
        coupon: {
            type: Schema.Types.ObjectId,
            ref: "Coupon",
            default: null,
        },
        code: {
            type: String,
            trim: true,
            default: "",
            uppercase: true,
        },
        discountType: {
            type: String,
            trim: true,
            default: "",
        },
        discountValue: {
            type: Number,
            default: 0,
            min: 0,
        },
        saved: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { _id: false }
);

/**
 * Audit event for the order lifecycle (created, paid, refunded, cancelled...).
 */
const orderEventSchema = new Schema(
    {
        type: {
            type: String,
            required: true,
            trim: true,
        },
        by: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        note: {
            type: String,
            trim: true,
            default: "",
        },
        at: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const orderSchema = new Schema(
    {
        /* ── Who & what ─────────────────────────────────────────── */
        student: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        items: {
            type: [orderItemSchema],
            required: true,
            validate: {
                validator: (items) => Array.isArray(items) && items.length > 0,
                message: "An order must contain at least one item.",
            },
        },

        /* ── Money ──────────────────────────────────────────────── */
        money: {
            type: moneySchema,
            required: true,
        },

        appliedCoupon: {
            type: appliedCouponSchema,
            default: () => ({}),
        },

        /* ── Payment / fulfillment references ───────────────────── */
        payment: {
            type: Schema.Types.ObjectId,
            ref: "Payment",
            default: null,
        },

        enrollment: {
            type: Schema.Types.ObjectId,
            ref: "Enrollment",
            default: null,
        },

        /* ── Lifecycle ──────────────────────────────────────────── */
        status: {
            type: String,
            enum: ORDER_STATUS_VALUES,
            default: ORDER_STATUS.PENDING_PAYMENT,
            index: true,
        },

        events: {
            type: [orderEventSchema],
            default: [],
        },

        note: {
            type: String,
            trim: true,
            default: "",
        },
    },
    { timestamps: true, versionKey: false }
);

/* ── Indexes ─────────────────────────────────────────────────────────── */
orderSchema.index({ student: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "items.course": 1 });

const Order = model("Order", orderSchema);

export default Order;
