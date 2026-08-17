/**
 * @file payout.model.js
 * @description Payout / withdrawal request model for the LearnX marketplace.
 *
 * Instructors request to withdraw funds from their wallet. An admin approves
 * the request and then marks it PAID (the manual workflow). Every state change
 * is appended to `events` for auditability. Optionally references the
 * Transaction that debited the wallet when paid.
 */

import mongoose from "mongoose";

import { PAYOUT_STATUS } from "../constants/payout.constants.js";
import { CURRENCIES } from "../constants/payment.constants.js";

const { Schema, model } = mongoose;

const STATUS_VALUES = Object.values(PAYOUT_STATUS);
const CURRENCY_VALUES = Object.values(CURRENCIES);

const payoutEventSchema = new Schema(
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

const payoutSchema = new Schema(
    {
        instructor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 1,
        },
        currency: {
            type: String,
            enum: CURRENCY_VALUES,
            default: CURRENCIES.USD,
        },

        status: {
            type: String,
            enum: STATUS_VALUES,
            default: PAYOUT_STATUS.PENDING,
            index: true,
        },

        /* ── Payout destination (manual workflow) ─────────────── */
        method: {
            type: String,
            trim: true,
            default: "",
        },
        accountDetails: {
            type: String,
            trim: true,
            default: "",
        },

        /* ── Admin decisions ──────────────────────────────────── */
        approvedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        approvedAt: {
            type: Date,
            default: null,
        },
        paidBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        paidAt: {
            type: Date,
            default: null,
        },
        rejectedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        rejectedAt: {
            type: Date,
            default: null,
        },
        rejectionReason: {
            type: String,
            trim: true,
            default: "",
        },

        // Wallet transaction that debited the funds on payment.
        transaction: {
            type: Schema.Types.ObjectId,
            ref: "Wallet",
            default: null,
        },

        adminNote: {
            type: String,
            trim: true,
            default: "",
        },

        events: {
            type: [payoutEventSchema],
            default: [],
        },
    },
    { timestamps: true, versionKey: false }
);

payoutSchema.index({ instructor: 1, createdAt: -1 });
payoutSchema.index({ status: 1, createdAt: -1 });

const Payout = model("Payout", payoutSchema);

export default Payout;
