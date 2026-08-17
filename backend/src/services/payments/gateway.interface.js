/**
 * @file gateway.interface.js
 * @description Abstract payment gateway interface + errors for the LearnX
 *              marketplace.
 *
 * Every provider adapter (Stripe, JazzCash, EasyPaisa) implements the same
 * contract so the checkout/payment services stay provider-agnostic. Providers
 * that are not configured throw `PaymentNotConfiguredError` at call time.
 */

import { AppError } from "../../errors/index.js";

/**
 * Thrown when a provider's credentials are not configured (app still boots).
 */
export class PaymentNotConfiguredError extends AppError {
    constructor(message = "This payment provider is not configured.") {
        super(message, 503); // 503 Service Unavailable — configuration gap.
    }
}

/**
 * Payment gateway contract.
 *
 * Implementations:
 *   isConfigured()                          -> boolean
 *   createCheckout({ payment, order, student, returnUrl, cancelUrl }) -> {
 *        checkoutUrl, providerTransactionId, providerStatus, raw }
 *   verifyPayment({ providerTransactionId }) -> { status, providerStatus, raw }
 *   handleWebhook(req)                       -> { event, providerTransactionId,
 *                                                  status, raw }   (throws if invalid signature)
 *   refund({ providerTransactionId, amount, currency, reason }) -> {
 *        providerRefundId, status, raw }
 *
 * `status` values returned by adapters use the canonical PAYMENT_STATUS values
 * (SUCCEEDED / FAILED / PENDING / PROCESSING) so services never need
 * provider-specific knowledge.
 */
export class PaymentGateway {
    constructor(name) {
        if (this.constructor === PaymentGateway) {
            throw new Error("PaymentGateway is abstract and cannot be instantiated.");
        }
        this.name = name;
    }

    isConfigured() {
        throw new Error(`${this.constructor.name}.isConfigured() not implemented`);
    }

    createCheckout() {
        throw new Error(`${this.constructor.name}.createCheckout() not implemented`);
    }

    verifyPayment() {
        throw new Error(`${this.constructor.name}.verifyPayment() not implemented`);
    }

    handleWebhook() {
        throw new Error(`${this.constructor.name}.handleWebhook() not implemented`);
    }

    refund() {
        throw new Error(`${this.constructor.name}.refund() not implemented`);
    }
}
