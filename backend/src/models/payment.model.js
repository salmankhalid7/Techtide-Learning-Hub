/**
 * @file payment.model.js
 * @description Payment model for the LearnX marketplace.
 *
 * A Payment represents a single charge attempt against a payment provider for
 * an order. It stores the provider's transaction identifiers, the idempotency
 * key (so a retry never double-charges), the amount, currency, status, and any
 * refunds. Security-relevant fields (provider raw response payloads) are stored
 * in `providerData` so support can diagnose without losing the structure.
 *
 * Idempotency guarantee:
 *  - `idempotencyKey` is unique per provider. Creating a payment re-uses an
 *    existing succeeded/pending payment for the same key instead of charging
 *    twice.
 */

import mongoose from "mongoose";

import {
    PAYMENT_PROVIDERS,
    PAYMENT_STATUS,
    PAYMENT_METHODS,
    CURRENCIES,
} from "../constants/payment.constants.js";

const { Schema, model } = mongoose;

const PROVIDER_VALUES = Object.values(PAYMENT_PROVIDERS);
const STATUS_VALUES = Object.values(PAYMENT_STATUS);
const METHOD_VALUES = Object.values(PAYMENT_METHODS);
const CURRENCY_VALUES = Object.values(CURRENCIES);

/**
 * A single refund against this payment.
 */
const refundSchema = new Schema(
    {
        providerRefundId: {
            type: String,
            trim: true,
            default: "",
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            enum: CURRENCY_VALUES,
            default: CURRENCIES.USD,
        },
        reason: {
            type: String,
            trim: true,
            default: "",
        },
        status: {
            type: String,
            trim: true,
            default: "",
        },
        initiatedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        refundedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const paymentSchema = new Schema(
    {
        /* ── Relationships ─────────────────────────────────────── */
        order: {
            type: Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            index: true,
        },
        student: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        /* ── Provider ──────────────────────────────────────────── */
        provider: {
            type: String,
            enum: PROVIDER_VALUES,
            required: true,
        },
        method: {
            type: String,
            enum: METHOD_VALUES,
            default: null,
        },

        // Provider-side identifiers (e.g. Stripe PaymentIntent id, JazzCash
        // transaction ref, EasyPaisa transaction id).
        providerTransactionId: {
            type: String,
            trim: true,
            default: "",
        },
        providerStatus: {
            type: String,
            trim: true,
            default: "",
        },

        /* ── Idempotency ───────────────────────────────────────── */
        idempotencyKey: {
            type: String,
            trim: true,
            default: "",
        },

        /* ── Money ─────────────────────────────────────────────── */
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            enum: CURRENCY_VALUES,
            required: true,
        },

        /* ── Status ────────────────────────────────────────────── */
        status: {
            type: String,
            enum: STATUS_VALUES,
            default: PAYMENT_STATUS.PENDING,
            index: true,
        },

        paidAt: {
            type: Date,
            default: null,
        },
        failedAt: {
            type: Date,
            default: null,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },

        failureCode: {
            type: String,
            trim: true,
            default: "",
        },
        failureMessage: {
            type: String,
            trim: true,
            default: "",
        },

        /* ── Refunds ───────────────────────────────────────────── */
        refunds: {
            type: [refundSchema],
            default: [],
        },
        refundedAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        /* ── Provider raw payload (diagnostics) ────────────────── */
        providerData: {
            type: Schema.Types.Mixed,
            default: {},
        },

        browsedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true, versionKey: false }
);

/* ── Indexes ─────────────────────────────────────────────────────────── */
// Unique idempotency key per provider: retries never double-charge.
paymentSchema.index(
    { provider: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);
paymentSchema.index({ student: 1, createdAt: -1 });

const Payment = model("Payment", paymentSchema);

export default Payment;
