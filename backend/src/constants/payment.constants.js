/**
 * @file payment.constants.js
 * @description Shared constants for the LearnX payment / marketplace module.
 *              Provides currency, provider, and status definitions used across
 *              orders, payments, coupons, payouts and invoices.
 */

/**
 * Supported payment providers / gateways.
 */
const PAYMENT_PROVIDERS = Object.freeze({
    STRIPE: "stripe",
    JAZZCASH: "jazzcash",
    EASYPAISA: "easypaisa",
});

/**
 * Payment status lifecycle.
 *
 * - PENDING      : created, waiting for the customer to complete payment.
 * - PROCESSING   : the gateway confirmed the payment is being processed.
 * - SUCCEEDED    : payment succeeded (webhook / verification confirmed it).
 * - FAILED       : payment failed (declined / gateway error / timeout).
 * - REFUNDED     : the full amount was refunded to the customer.
 * - PARTIALLY_REFUNDED : only part of the amount was refunded.
 * - CANCELLED    : the payment/order was cancelled before completion.
 */
const PAYMENT_STATUS = Object.freeze({
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    SUCCEEDED: "SUCCEEDED",
    FAILED: "FAILED",
    REFUNDED: "REFUNDED",
    PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
    CANCELLED: "CANCELLED",
});

/**
 * Supported payment methods (broad categories used to validate submissions).
 */
const PAYMENT_METHODS = Object.freeze({
    CARD: "card",
    WALLET: "wallet",
    BANK_TRANSFER: "bank_transfer",
    MOBILE_MONEY: "mobile_money",
});

/**
 * Supported currencies. USD (international) and PKR (Pakistan).
 */
const CURRENCIES = Object.freeze({
    USD: "USD",
    PKR: "PKR",
});

/**
 * Platform commission configuration keys.
 */
const COMMISSION = Object.freeze({
    // Default percentage taken by the platform from each sale.
    DEFAULT_RATE_PERCENT: 10,
    // Default percentage of a course order that is an instructor earnings.
    INSTRUCTOR_SHARE_PERCENT: 90,
});

export {
    PAYMENT_PROVIDERS,
    PAYMENT_STATUS,
    PAYMENT_METHODS,
    CURRENCIES,
    COMMISSION,
};
