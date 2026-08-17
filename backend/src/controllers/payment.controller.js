/**
 * @file payment.controller.js
 * @description Payment/checkout controllers for the LearnX marketplace.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";

import {
    initiatePayment as initiatePaymentService,
    verifyPayment as verifyPaymentService,
    handleWebhook as handleWebhookService,
    refundPayment as refundPaymentService,
} from "../services/payment.service.js";
import { createCheckout as createCheckoutService } from "../services/order.service.js";
import { generateInvoice } from "../services/invoice.service.js";

/**
 * POST /checkout
 * Create a checkout intent for a course (free => enroll; paid => order+payment).
 */
const createCheckout = asyncHandler(async (req, res) => {
    const checkout = await createCheckoutService({
        studentId: req.user._id,
        courseId: req.body.courseId,
        provider: req.body.provider,
        couponCode: req.body.couponCode,
        returnUrl: req.body.returnUrl,
        cancelUrl: req.body.cancelUrl,
        idempotencyKey: req.body.idempotencyKey,
    });

    if (checkout.mode === "free") {
        return res
            .status(200)
            .json(new ApiResponse(200, "Enrolled in free course.", { mode: "free", checkout }));
    }

    return res
        .status(201)
        .json(new ApiResponse(201, "Checkout created.", { mode: "paid", checkout }));
});

/**
 * POST /payments/:paymentId/initiate
 * Request the provider checkout session for a created payment.
 */
const initiatePayment = asyncHandler(async (req, res) => {
    const result = await initiatePaymentService({
        paymentId: req.params.paymentId,
        returnUrl: req.body.returnUrl,
        cancelUrl: req.body.cancelUrl,
    });
    return res.status(200).json(new ApiResponse(200, "Payment initiated.", result));
});

/**
 * POST /payments/:paymentId/verify
 * Verify a payment's status (and grant enrollment if succeeded).
 */
const verifyPayment = asyncHandler(async (req, res) => {
    const result = await verifyPaymentService({
        paymentId: req.params.paymentId,
        providerParams: req.body.providerParams || null,
    });
    return res.status(200).json(new ApiResponse(200, "Payment verified.", result));
});

/**
 * POST /payments/webhook/:provider
 * Provider webhook / IPN endpoint. Signature-verified inside the gateway then
 * applied here.
 */
const handleWebhook = asyncHandler(async (req, res) => {
    const result = await handleWebhookService({ req, provider: req.params.provider });
    return res.status(200).json(new ApiResponse(200, "Webhook received.", result));
});

/**
 * POST /payments/:paymentId/refund
 * Refund a paid payment (full by default, partial if `amount` is given).
 */
const refundPayment = asyncHandler(async (req, res) => {
    const result = await refundPaymentService({
        paymentId: req.params.paymentId,
        amount: req.body.amount ?? null,
        reason: req.body.reason,
        initiatedBy: req.user._id,
    });
    return res.status(200).json(new ApiResponse(200, "Refund processed.", result));
});

/**
 * GET /payments/config
 * Public list of configured providers + whether credentials are set (never
 * exposes the keys themselves).
 */
const getPaymentConfig = asyncHandler(async (req, res) => {
    const { listGateways } = await import("../services/payments/gateway.registry.js");
    return res.status(200).json(new ApiResponse(200, "Payment providers.", listGateways()));
});

export {
    createCheckout,
    initiatePayment,
    verifyPayment,
    handleWebhook,
    refundPayment,
    getPaymentConfig,
};
