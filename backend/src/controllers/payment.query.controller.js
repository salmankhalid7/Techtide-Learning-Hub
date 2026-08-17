/**
 * @file payment.query.controller.js
 * @description Read-side payment history/detail controllers.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";
import { ForbiddenError } from "../errors/index.js";

import Payment from "../models/payment.model.js";
import {
    getMyPayments as getMyPaymentsService,
} from "../services/order.query.service.js";

/**
 * GET /payments/mine — student's payment history.
 */
const getMyPayments = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const result = await getMyPaymentsService({ studentId: req.user._id, page, limit });
    return res.status(200).json(new ApiResponse(200, "Payments fetched.", result));
});

/**
 * GET /payments/:paymentId — fetch a single payment (owner or admin).
 */
const getPayment = asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.paymentId).populate("order");
    if (!payment) {
        return res.status(404).json(new ApiResponse(404, "Payment not found."));
    }
    if (req.user.role !== "admin" && payment.student.toString() !== req.user._id.toString()) {
        throw new ForbiddenError("You are not allowed to view this payment.");
    }
    return res.status(200).json(new ApiResponse(200, "Payment fetched.", payment));
});

export { getMyPayments, getPayment };
