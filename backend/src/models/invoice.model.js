/**
 * @file invoice.model.js
 * @description Invoice / receipt model for the LearnX marketplace.
 *
 * A receipt is generated when a paid order succeeds. It snapshots the buyer,
 * seller (course instructor), amounts, commission, tax (if any) and the payment
 * reference so the invoice is immutable even if the underlying records change.
 * One invoice per paid order (unique index on `order`).
 */

import mongoose from "mongoose";

import { CURRENCIES } from "../constants/payment.constants.js";
import { ORDER_ITEM_TYPES } from "../constants/order.constants.js";

const { Schema, model } = mongoose;

const CURRENCY_VALUES = Object.values(CURRENCIES);

const invoiceItemSchema = new Schema(
    {
        itemType: {
            type: String,
            enum: Object.values(ORDER_ITEM_TYPES),
            default: ORDER_ITEM_TYPES.COURSE,
        },
        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
        },
        courseTitle: {
            type: String,
            trim: true,
            default: "",
        },
        unitPrice: {
            type: Number,
            required: true,
            min: 0,
        },
        quantity: {
            type: Number,
            default: 1,
            min: 1,
        },
    },
    { _id: false }
);

const invoiceSchema = new Schema(
    {
        invoiceNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        order: {
            type: Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            unique: true,
            index: true,
        },
        payment: {
            type: Schema.Types.ObjectId,
            ref: "Payment",
            default: null,
        },

        student: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        instructor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        currency: {
            type: String,
            enum: CURRENCY_VALUES,
            required: true,
        },

        items: {
            type: [invoiceItemSchema],
            default: [],
        },

        // Money snapshot.
        subtotal: { type: Number, default: 0, min: 0 },
        discount: { type: Number, default: 0, min: 0 },
        total: { type: Number, required: true, min: 0 },

        // Platform commission (part of the total retained by the platform).
        commission: { type: Number, default: 0, min: 0 },
        commissionRatePercent: { type: Number, default: 0, min: 0 },
        instructorNet: { type: Number, default: 0, min: 0 },

        // Payment details.
        provider: { type: String, trim: true, default: "" },
        providerTransactionId: { type: String, trim: true, default: "" },

        status: {
            type: String,
            trim: true,
            default: "paid",
        },

        issuedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true, versionKey: false }
);

invoiceSchema.index({ student: 1, issuedAt: -1 });

const Invoice = model("Invoice", invoiceSchema);

export default Invoice;
