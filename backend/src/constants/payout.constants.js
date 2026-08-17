/**
 * @file payout.constants.js
 * @description Payout / withdrawal and instructor-ledger constants for the
 *              LearnX marketplace finance system.
 */

/**
 * Payout (withdrawal) request status lifecycle.
 *
 * - PENDING   : instructor requested a withdrawal; awaiting admin approval.
 * - APPROVED  : admin approved; funds marked for payout.
 * - PAID      : admin marked the payout as paid out (manual workflow).
 * - REJECTED  : admin rejected the request (with a reason).
 */
const PAYOUT_STATUS = Object.freeze({
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    PAID: "PAID",
    REJECTED: "REJECTED",
});

/**
 * Instructor wallet transaction types.
 *
 * - COURSE_SALE  : credit from a completed course purchase (net of commission).
 * - REFUND       : debit when a sale is refunded.
 * - WITHDRAWAL   : debit when a payout is paid out.
 * - ADJUSTMENT   : manual credit/debit by an admin.
 */
const TRANSACTION_TYPES = Object.freeze({
    COURSE_SALE: "course_sale",
    REFUND: "refund",
    WITHDRAWAL: "withdrawal",
    ADJUSTMENT: "adjustment",
});

/**
 * Instructor wallet transaction direction.
 */
const TRANSACTION_DIRECTIONS = Object.freeze({
    CREDIT: "credit",
    DEBIT: "debit",
});

export {
    PAYOUT_STATUS,
    TRANSACTION_TYPES,
    TRANSACTION_DIRECTIONS,
};
