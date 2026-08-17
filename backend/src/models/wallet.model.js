/**
 * @file wallet.model.js
 * @description Instructor wallet / earnings ledger for the LearnX marketplace.
 *
 * Each instructor has a Wallet that accumulates net-of-commission course
 * earnings (credits) and is debited by refunds and payouts. Every change is a
 * Transaction entry for a full, auditable history. The `balance` is derived and
 * must always equal the sum of its transactions.
 */

import mongoose from "mongoose";

import {
    TRANSACTION_TYPES,
    TRANSACTION_DIRECTIONS,
} from "../constants/payout.constants.js";
import { CURRENCIES } from "../constants/payment.constants.js";

const { Schema, model } = mongoose;

const TRANSACTION_TYPE_VALUES = Object.values(TRANSACTION_TYPES);
const TRANSACTION_DIRECTION_VALUES = Object.values(TRANSACTION_DIRECTIONS);
const CURRENCY_VALUES = Object.values(CURRENCIES);

/**
 * A single ledger entry on the instructor's wallet.
 */
const transactionSchema = new Schema(
    {
        type: {
            type: String,
            enum: TRANSACTION_TYPE_VALUES,
            required: true,
        },
        direction: {
            type: String,
            enum: TRANSACTION_DIRECTION_VALUES,
            required: true,
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
        balanceAfter: {
            type: Number,
            default: 0,
        },

        // Optional linkage back to the source.
        order: {
            type: Schema.Types.ObjectId,
            ref: "Order",
            default: null,
        },
        payment: {
            type: Schema.Types.ObjectId,
            ref: "Payment",
            default: null,
        },
        payout: {
            type: Schema.Types.ObjectId,
            ref: "Payout",
            default: null,
        },
        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            default: null,
        },

        description: {
            type: String,
            trim: true,
            default: "",
        },

        // For ADJUSTMENT transactions.
        adjustedBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false }
);

const walletSchema = new Schema(
    {
        instructor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },
        currency: {
            type: String,
            enum: CURRENCY_VALUES,
            default: CURRENCIES.USD,
        },

        // Running balance (net earnings available for withdrawal).
        balance: {
            type: Number,
            default: 0,
            min: 0,
        },

        // Total lifetime earnings credited (never decreases on refund; refunds
        // post as separate DEBIT transactions).
        totalEarned: {
            type: Number,
            default: 0,
            min: 0,
        },

        // Total paid out via withdrawals.
        totalWithdrawn: {
            type: Number,
            default: 0,
            min: 0,
        },

        transactions: {
            type: [transactionSchema],
            default: [],
        },
    },
    { timestamps: true, versionKey: false }
);

const Wallet = model("Wallet", walletSchema);

export default Wallet;
