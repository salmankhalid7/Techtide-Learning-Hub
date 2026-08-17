/**
 * @file payout.validator.js
 * @description Validators for the LearnX payout/withdrawal routes.
 */

import { body, param, query } from "express-validator";
import mongoose from "mongoose";

import { TRANSACTION_DIRECTIONS } from "../constants/payout.constants.js";
import { PAYOUT_STATUS } from "../constants/payout.constants.js";

const isMongoId = (value) => mongoose.Types.ObjectId.isValid(value);

const requestPayoutValidator = [
    body("amount").isFloat({ min: 0.01 }).withMessage("Amount must be a positive number."),
    body("method").optional().isString().isLength({ max: 50 }),
    body("accountDetails").optional().isString().isLength({ max: 500 }),
];

const getMyPayoutsValidator = [
    query("page").optional().isInt({ min: 1 }).withMessage("Invalid page."),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Invalid limit."),
];

const getPayoutsValidator = [
    query("page").optional().isInt({ min: 1 }).withMessage("Invalid page."),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Invalid limit."),
    query("status")
        .optional()
        .isIn(Object.values(PAYOUT_STATUS))
        .withMessage("Invalid status."),
];

const getPayoutValidator = [param("payoutId").custom(isMongoId).withMessage("Invalid payoutId.")];

const approvePayoutValidator = [
    param("payoutId").custom(isMongoId).withMessage("Invalid payoutId."),
    body("note").optional().isString().isLength({ max: 500 }),
];

const rejectPayoutValidator = [
    param("payoutId").custom(isMongoId).withMessage("Invalid payoutId."),
    body("reason").optional().isString().isLength({ max: 500 }),
];

const markPayoutPaidValidator = [
    param("payoutId").custom(isMongoId).withMessage("Invalid payoutId."),
];

/* Wallet */
const adjustWalletValidator = [
    param("instructorId").custom(isMongoId).withMessage("Invalid instructorId."),
    body("amount").isFloat({ min: 0.01 }).withMessage("Amount must be positive."),
    body("direction")
        .isIn(Object.values(TRANSACTION_DIRECTIONS))
        .withMessage("Invalid direction."),
    body("description").optional().isString().isLength({ max: 500 }),
];

export {
    requestPayoutValidator,
    getMyPayoutsValidator,
    getPayoutsValidator,
    getPayoutValidator,
    approvePayoutValidator,
    rejectPayoutValidator,
    markPayoutPaidValidator,
    adjustWalletValidator,
};
