/**
 * @file order.constants.js
 * @description Order lifecycle constants for the LearnX marketplace.
 */

/**
 * Order status lifecycle.
 *
 * - PENDING_PAYMENT : created at checkout, awaiting payment completion.
 * - PAID            : payment succeeded; enrollment granted.
 * - FAILED          : payment failed / was declined.
 * - CANCELLED       : order cancelled before payment completed.
 * - REFUNDED        : fully refunded (enrollment removed).
 * - PARTIALLY_REFUNDED : partially refunded.
 */
const ORDER_STATUS = Object.freeze({
    PENDING_PAYMENT: "PENDING_PAYMENT",
    PAID: "PAID",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
    REFUNDED: "REFUNDED",
    PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
});

/**
 * Order item types. Only COURSE items are enrollable today, but the schema
 * keeps the type field so bundles/add-ons could be added later.
 */
const ORDER_ITEM_TYPES = Object.freeze({
    COURSE: "course",
});

export { ORDER_STATUS, ORDER_ITEM_TYPES };
