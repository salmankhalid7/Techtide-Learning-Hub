/**
 * @file payment.validator.js
 * @description Validators for the LearnX payment/checkout routes.
 */

import { body, param, query } from "express-validator";
import mongoose from "mongoose";

import { PAYMENT_PROVIDERS } from "../constants/payment.constants.js";

const objectIdRule = (field, source = "params") =>
    (source === "params" ? param(field) : body(field))
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage(`Invalid ${field}.`);

const isMongoId = (value) => mongoose.Types.ObjectId.isValid(value);

/**
 * POST /checkout
 */
const createCheckoutValidator = [
    body("courseId").custom(isMongoId).withMessage("Invalid courseId."),
    body("provider")
        .optional()
        .isIn(Object.values(PAYMENT_PROVIDERS))
        .withMessage("Unsupported payment provider."),
    body("couponCode").optional().trim().isString().withMessage("Invalid coupon code."),
    body("returnUrl").optional().isURL().withMessage("returnUrl must be a valid URL."),
    body("cancelUrl").optional().isURL().withMessage("cancelUrl must be a valid URL."),
    body("idempotencyKey")
        .optional()
        .isString()
        .isLength({ max: 200 })
        .withMessage("idempotencyKey must be a string."),
];

/**
 * POST /payments/:paymentId/initiate
 */
const initiatePaymentValidator = [
    objectIdRule("paymentId"),
    body("returnUrl").optional().isURL().withMessage("returnUrl must be a valid URL."),
    body("cancelUrl").optional().isURL().withMessage("cancelUrl must be a valid URL."),
];

/**
 * POST /payments/:paymentId/verify
 */
const verifyPaymentValidator = [
    objectIdRule("paymentId"),
    body("providerParams").optional().isObject().withMessage("providerParams must be an object."),
];

/**
 * POST /payments/:paymentId/refund
 */
const refundPaymentValidator = [
    objectIdRule("paymentId"),
    body("amount").optional().isFloat({ min: 0.01 }).withMessage("Amount must be positive."),
    body("reason").optional().isString().isLength({ max: 1000 }).withMessage("Invalid reason."),
];

/**
 * POST /payments/webhook/:provider
 */
const handleWebhookValidator = [
    param("provider").isIn(Object.values(PAYMENT_PROVIDERS)).withMessage("Unsupported provider."),
];

/**
 * GET /payments/mine
 */
const getMyPaymentsValidator = [
    query("page").optional().isInt({ min: 1 }).withMessage("Invalid page."),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Invalid limit."),
];

/**
 * GET /payments/:paymentId
 */
const getPaymentValidator = [objectIdRule("paymentId")];

export {
    createCheckoutValidator,
    initiatePaymentValidator,
    verifyPaymentValidator,
    refundPaymentValidator,
    handleWebhookValidator,
    getMyPaymentsValidator,
    getPaymentValidator,
};
