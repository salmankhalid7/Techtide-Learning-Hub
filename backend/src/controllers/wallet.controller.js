/**
 * @file wallet.controller.js
 * @description Instructor wallet/earnings controllers.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";

import {
    getWallet as getWalletService,
    getTransactions as getTransactionsService,
    adjustWallet as adjustWalletService,
} from "../services/wallet.service.js";

/**
 * GET /wallet/mine  — instructor's own wallet + transactions.
 */
const getMyWallet = asyncHandler(async (req, res) => {
    const wallet = await getWalletService({ instructorId: req.user._id });
    return res.status(200).json(new ApiResponse(200, "Wallet fetched.", wallet));
});

/**
 * GET /wallet/mine/transactions  — paginated transaction history.
 */
const getMyTransactions = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const result = await getTransactionsService({
        instructorId: req.user._id,
        page,
        limit,
    });
    return res.status(200).json(new ApiResponse(200, "Transactions fetched.", result));
});

/**
 * POST /wallet/:instructorId/adjust  — admins adjust a wallet.
 */
const adjustWallet = asyncHandler(async (req, res) => {
    const wallet = await adjustWalletService({
        adjustmentBy: req.user._id,
        adjustmentData: {
            instructorId: req.params.instructorId,
            amount: req.body.amount,
            direction: req.body.direction,
            description: req.body.description,
        },
    });
    return res.status(200).json(new ApiResponse(200, "Wallet adjusted.", wallet));
});

export { getMyWallet, getMyTransactions, adjustWallet };
