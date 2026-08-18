/**
 * @file payment.service.js
 * @description Payment orchestration for the LearnX marketplace.
 *
 * Wraps the provider-agnostic gateway layer with the domain workflow:
 *   - initiatePayment  : create the gateway checkout session.
 *   - verifyPayment    : confirm payment status with the provider.
 *   - handleWebhook    : verify + apply a provider webhook/IPN.
 *   - refundPayment    : full/partial refund + revert enrollment + debit wallet.
 *
 * Payment statuses use the canonical PAYMENT_STATUS values (see
 * payment.constants.js). Idempotency is preserved: processing an already
 * succeeded payment is a no-op rather than a double charge.
 */

import mongoose from "mongoose";

import Payment from "../models/payment.model.js";
import Order from "../models/order.model.js";
import Enrollment from "../models/enrollment.model.js";
import Wallet from "../models/wallet.model.js";

import { PAYMENT_STATUS, PAYMENT_PROVIDERS } from "../constants/payment.constants.js";
import { ORDER_STATUS } from "../constants/order.constants.js";
import { ENROLLMENT_STATUS } from "../constants/enrollment.constants.js";

import { NotFoundError, BadRequestError } from "../errors/index.js";
import logger from "../config/logger.js";
import { getGateway } from "./payments/gateway.registry.js";
import { grantPaidEnrollment } from "./order.service.js";
import { notifyUser } from "./notification.service.js";
import { NOTIFICATION_TYPES } from "../constants/notification.constants.js";

/**
 * Initiate a payment with the provider (create the checkout session).
 * Returns gateway checkout details (URL / form fields) for the client.
 *
 * @param {object} params
 * @param {string} params.paymentId
 * @param {string} params.returnUrl
 * @param {string} params.cancelUrl
 */
export const initiatePayment = async ({ paymentId, returnUrl, cancelUrl }) => {
    const payment = await Payment.findById(paymentId)
        .populate("order")
        .populate("student", "-password");
    if (!payment) {
        throw new NotFoundError("Payment not found");
    }

    // Already succeeded => nothing to re-initiate.
    if (payment.status === PAYMENT_STATUS.SUCCEEDED) {
        return {
            alreadyCompleted: true,
            checkoutUrl: null,
            payment,
        };
    }

    const gateway = getGateway(payment.provider);
    const checkout = await gateway.createCheckout({
        payment,
        order: payment.order,
        student: payment.student,
        returnUrl,
        cancelUrl,
    });

    await Payment.updateOne(
        { _id: payment._id },
        {
            $set: {
                providerTransactionId: checkout.providerTransactionId,
                providerStatus: checkout.providerStatus,
                providerData: checkout.raw || {},
                status: PAYMENT_STATUS.PROCESSING,
            },
        }
    );

    return {
        alreadyCompleted: false,
        checkoutUrl: checkout.checkoutUrl,
        formFields: checkout.formFields || null,
        redirectMethod: checkout.redirectMethod || "GET",
        provider: payment.provider,
        payment,
    };
};

/**
 * Verify a payment with the provider and, if succeeded, grant enrollment.
 * Used by the frontend return handler and explicit verification endpoint.
 *
 * @param {object} params
 * @param {string} params.paymentId
 * @param {object} [params.providerParams] - postback params for redirect providers
 * @returns {Promise<object>}
 */
export const verifyPayment = async ({ paymentId, providerParams = null }) => {
    const payment = await Payment.findById(paymentId).populate("order");
    if (!payment) {
        throw new NotFoundError("Payment not found");
    }

    // Idempotent: already succeeded => just return it.
    if (payment.status === PAYMENT_STATUS.SUCCEEDED) {
        return { payment, enrollmentGranted: true, alreadySucceeded: true };
    }

    const gateway = getGateway(payment.provider);
    const result = await gateway.verifyPayment({
        providerTransactionId: payment.providerTransactionId,
        params: providerParams,
    });

    // Apply the status transition.
    const updated = await _applyPaymentStatus({
        paymentId: payment._id,
        status: result.status,
        providerStatus: result.providerStatus,
        raw: result.raw,
        providerTransactionId: result.providerTransactionId,
    });

    let enrollmentGranted = false;
    if (result.status === PAYMENT_STATUS.SUCCEEDED) {
        const { enrolled } = await grantPaidEnrollment({ paymentId: payment._id });
        enrollmentGranted = true;
    }

    return { payment: updated, enrollmentGranted, alreadySucceeded: false };
};

/**
 * Verify + handle a provider webhook/IPN.
 *
 * @param {object} req - the raw Express request.
 * @param {string} provider - provider name.
 * @returns {Promise<object>}
 */
export const handleWebhook = async ({ req, provider }) => {
    const gateway = getGateway(provider);
    const parsed = await gateway.handleWebhook(req);
    const { providerTransactionId } = parsed;

    if (!providerTransactionId) {
        // Could not identify the payment; ack anyway to avoid retries loops.
        return { handled: false, providerTransactionId: null };
    }

    // Locate the payment by provider transaction id or an idempotency marker.
    let payment = await Payment.findOne({
        provider,
        providerTransactionId,
    });

    if (!payment && parsed.raw) {
        // Fallback: try to resolve via student/order metadata.
        payment = await _resolvePaymentFromWebhook(provider, parsed.raw);
    }

    if (!payment) {
        logger.warn("Webhook for unknown payment", { provider, providerTransactionId });
        return { handled: false, providerTransactionId };
    }

    await _applyPaymentStatus({
        paymentId: payment._id,
        status: parsed.status,
        providerStatus: parsed.raw?.providerStatus || "",
        raw: parsed.raw,
        providerTransactionId,
    });

    if (parsed.status === PAYMENT_STATUS.SUCCEEDED && payment.status !== PAYMENT_STATUS.SUCCEEDED) {
        await grantPaidEnrollment({ paymentId: payment._id });
    }

    return { handled: true, providerTransactionId, paymentId: payment._id };
};

/**
 * Apply a canonical payment-status transition, guarding against regressions on
 * an already-succeeded payment.
 */
const _applyPaymentStatus = async ({
    paymentId,
    status,
    providerStatus,
    raw,
    providerTransactionId,
}) => {
    const payment = await Payment.findById(paymentId);
    if (!payment) throw new NotFoundError("Payment not found");

    // Never regress a succeeded payment (idempotency for late/repeat webhooks).
    if (payment.status === PAYMENT_STATUS.SUCCEEDED) {
        return payment;
    }

    const set = {
        providerStatus,
        providerTransactionId: providerTransactionId || payment.providerTransactionId,
        providerData: raw || {},
    };

    if (status === PAYMENT_STATUS.SUCCEEDED) {
        set.status = PAYMENT_STATUS.SUCCEEDED;
        set.paidAt = new Date();
    } else if (status === PAYMENT_STATUS.FAILED) {
        set.status = PAYMENT_STATUS.FAILED;
        set.failedAt = new Date();
    } else if (status === PAYMENT_STATUS.CANCELLED) {
        set.status = PAYMENT_STATUS.CANCELLED;
        set.cancelledAt = new Date();
    } else if (status === PAYMENT_STATUS.REFUNDED || status === PAYMENT_STATUS.PARTIALLY_REFUNDED) {
        set.status = status;
    } else {
        set.status = PAYMENT_STATUS.PROCESSING;
    }

    await Payment.updateOne({ _id: payment._id }, { $set: set });
    return Payment.findById(payment._id);
};

/**
 * Refund a payment (full or partial). On full refund the order becomes
 * REFUNDED and paid enrollment is reverted; the instructor wallet is debited.
 */
export const refundPayment = async ({
    paymentId,
    amount = null,
    reason = "",
    initiatedBy = null,
}) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const payment = await Payment.findById(paymentId).session(session).populate("order");
        if (!payment) throw new NotFoundError("Payment not found");
        if (payment.status !== PAYMENT_STATUS.SUCCEEDED) {
            throw new BadRequestError("Only succeeded payments can be refunded.");
        }

        const refundAmount = amount == null ? payment.amount : Number(amount);
        if (refundAmount <= 0 || refundAmount > payment.amount - payment.refundedAmount) {
            throw new BadRequestError("Refund amount exceeds the refundable balance.");
        }

        const gateway = getGateway(payment.provider);
        const result = await gateway.refund({
            providerTransactionId: payment.providerTransactionId,
            amount: refundAmount,
            currency: payment.currency,
            reason,
        });

        const newRefundedAmount = Math.round((payment.refundedAmount + refundAmount) * 100) / 100;
        const isFull = newRefundedAmount >= payment.amount - 0.001;

        await Payment.updateOne(
            { _id: payment._id },
            {
                $set: {
                    status: isFull ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED,
                    refundedAmount: newRefundedAmount,
                },
                $push: {
                    refunds: {
                        providerRefundId: result.providerRefundId,
                        amount: refundAmount,
                        currency: payment.currency,
                        reason,
                        status: result.status,
                        initiatedBy,
                        refundedAt: new Date(),
                    },
                },
            }
        ).session(session);

        // Full refund => revert order + enrollment + instructor debit.
        if (isFull) {
            await Order.updateOne(
                { _id: payment.order._id },
                {
                    $set: { status: ORDER_STATUS.REFUNDED },
                    $push: { events: { type: "refunded", note: reason || "Full refund" } },
                }
            ).session(session);

            const order = payment.order;
            const item = order.items[0];
            if (item) {
                await Enrollment.updateOne(
                    {
                        student: payment.student,
                        course: item.course,
                        status: ENROLLMENT_STATUS.ACTIVE,
                    },
                    {
                        $set: {
                            status: ENROLLMENT_STATUS.DROPPED,
                            droppedAt: new Date(),
                        },
                    }
                ).session(session);

                await _debitInstructorEarnings({ order, payment, amount: refundAmount, session });
            }
        }

        await session.commitTransaction();

        // ── Emit notifications (post-commit, only after a successful refund) ──
        const order = payment.order;
        const item = order.items?.[0];
        const courseTitle = item?.courseTitle || "Course";

        // Student: refund processed for their purchase.
        await notifyUser({
            recipient: payment.student,
            type: NOTIFICATION_TYPES.PAYMENT_REFUNDED,
            title: isFull ? "Refund processed" : "Partial refund processed",
            body: `Your refund of ${payment.currency} ${refundAmount} for "${courseTitle}" was processed.`,
            data: { course: item?.course, order: order._id, payment: payment._id, amount: refundAmount },
        });

        // Instructor (full refund): their wallet was debited.
        if (isFull && item?.instructor) {
            await notifyUser({
                recipient: item.instructor,
                type: NOTIFICATION_TYPES.PAYMENT_REFUNDED,
                title: "Course refunded",
                body: `A sale for "${courseTitle}" was refunded. Your wallet was adjusted.`,
                data: { course: item.course, payment: payment._id, amount: refundAmount },
            });
        }

        return Payment.findById(paymentId);
    } catch (error) {
        await session.abortTransaction();
        logger.error("Refund failed", { paymentId, error: error.message });
        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * Debit the instructor wallet after a refund (full).
 */
const _debitInstructorEarnings = async ({ order, payment, amount, session }) => {
    const item = order.items[0];
    if (!item) return;

    const wallet = await Wallet.findOne({ instructor: item.instructor }).session(session);
    if (!wallet) return;

    const debit = Math.min(amount, wallet.balance);
    const newBalance = Math.round((wallet.balance - debit) * 100) / 100;

    await Wallet.updateOne(
        { _id: wallet._id },
        {
            $set: { balance: newBalance },
            /* totalEarned is NOT decremented — refund posts as a DEBIT entry. */
            $push: {
                transactions: {
                    type: "refund",
                    direction: "debit",
                    amount: debit,
                    currency: wallet.currency,
                    balanceAfter: newBalance,
                    order: order._id,
                    payment: payment._id,
                    course: item.course,
                    description: `Refund for order ${order._id}`,
                },
            },
        }
    ).session(session);
};

/**
 * Try to resolve a payment from a webhook/IPN raw payload when the
 * providerTransactionId didn't match directly. Looks for embedded ids.
 */
const _resolvePaymentFromWebhook = async (provider, raw) => {
    const ids = [
        raw?.paymentId,
        raw?.payment_id,
        raw?.metadata?.paymentId,
        raw?.data?.object?.metadata?.paymentId,
    ].filter(Boolean);

    for (const id of ids) {
        const match = await Payment.findOne({ _id: id, provider }).catch(() => null);
        if (match) return match;
    }
    return null;
};
