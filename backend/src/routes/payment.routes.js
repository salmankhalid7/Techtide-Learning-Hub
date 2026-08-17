/**
 * @file payment.routes.js
 * @description Routes for the LearnX payment/checkout system.
 */

import { Router } from "express";

import {
    createCheckout,
    initiatePayment,
    verifyPayment,
    handleWebhook,
    refundPayment,
    getPaymentConfig,
} from "../controllers/payment.controller.js";
import {
    getMyPayments,
    getPayment,
} from "../controllers/payment.query.controller.js";

import {
    createCheckoutValidator,
    initiatePaymentValidator,
    verifyPaymentValidator,
    refundPaymentValidator,
    handleWebhookValidator,
    getMyPaymentsValidator,
    getPaymentValidator,
} from "../validators/payment.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

/* ── Public (no auth) ─────────────────────────────────────────────── */
router.get("/payments/config", getPaymentConfig);

/* Stripe/JazzCash/EasyPaisa webhook + IPN endpoint (no auth, signature-verified
   internally by the gateway; the provider itself is the caller). */
router.post(
    "/payments/webhook/:provider",
    handleWebhookValidator,
    validate,
    handleWebhook
);

/* ── Student: checkout & payment lifecycle ────────────────────────── */
router.post(
    "/checkout",
    authenticate,
    authorize("student", "instructor", "admin"),
    createCheckoutValidator,
    validate,
    createCheckout
);

router.post(
    "/payments/:paymentId/initiate",
    authenticate,
    authorize("student", "instructor", "admin"),
    initiatePaymentValidator,
    validate,
    initiatePayment
);

router.post(
    "/payments/:paymentId/verify",
    authenticate,
    authorize("student", "instructor", "admin"),
    verifyPaymentValidator,
    validate,
    verifyPayment
);

/* Admin/student refund (student refunds are restricted in the service to
   succeeded payments; only admins may initiate) */
router.post(
    "/payments/:paymentId/refund",
    authenticate,
    authorize("admin"),
    refundPaymentValidator,
    validate,
    refundPayment
);

/* ── Student: payment history ─────────────────────────────────────── */
router.get(
    "/payments/mine",
    authenticate,
    authorize("student", "instructor", "admin"),
    getMyPaymentsValidator,
    validate,
    getMyPayments
);

router.get(
    "/payments/:paymentId",
    authenticate,
    authorize("student", "instructor", "admin"),
    getPaymentValidator,
    validate,
    getPayment
);

export default router;
