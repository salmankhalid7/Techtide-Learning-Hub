/**
 * @file coupon.constants.js
 * @description Coupon / discount code constants for the LearnX marketplace.
 */

/**
 * Coupon discount types.
 *
 * - PERCENTAGE : discount is a percentage off (e.g. 20%).
 * - FIXED      : discount is a fixed amount off the order.
 */
const COUPON_DISCOUNT_TYPES = Object.freeze({
    PERCENTAGE: "percentage",
    FIXED: "fixed",
});

/**
 * Coupon usage scope.
 *
 * - SINGLE_USE : each coupon code can be used once in total.
 * - MULTI_USE  : each coupon code can be used up to `maxUses`.
 */
const COUPON_USAGE_SCOPES = Object.freeze({
    SINGLE_USE: "single_use",
    MULTI_USE: "multi_use",
});

/**
 * Coupon status.
 */
const COUPON_STATUS = Object.freeze({
    ACTIVE: "active",
    DISABLED: "disabled",
    EXPIRED: "expired",
});

export {
    COUPON_DISCOUNT_TYPES,
    COUPON_USAGE_SCOPES,
    COUPON_STATUS,
};
