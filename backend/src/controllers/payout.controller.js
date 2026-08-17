/**
 * @file payout.controller.js
 * @description Instructor payout/withdrawal controllers + admin management.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";

import {
    requestPayout as requestPayoutService,
    getMyPayouts as getMyPayoutsService,
    getPayouts as getPayoutsService,
    getPayout as getPayoutService,
    approvePayout as approvePayoutService,
    rejectPayout as rejectPayoutService,
    markPayoutPaid as markPayoutPaidService,
} from "../services/payout.service.js";

/**
 * POST /payouts/request — instructor requests a withdrawal.
 */
const requestPayout = asyncHandler(async (req, res) => {
    const payout = await requestPayoutService({
        instructorId: req.user._id,
        data: req.body,
    });
    return res.status(201).json(new ApiResponse(201, "Payout requested.", payout));
});

/**
 * GET /payouts/mine — instructor's payout/withdrawal history.
 */
const getMyPayouts = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const result = await getMyPayoutsService({
        instructorId: req.user._id,
        page,
        limit,
    });
    return res.status(200).json(new ApiResponse(200, "Payouts fetched.", result));
});

/**
 * GET /payouts — admin lists all payout requests.
 */
const getPayouts = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const result = await getPayoutsService({
        page,
        limit,
        status: req.query.status,
    });
    return res.status(200).json(new ApiResponse(200, "Payouts fetched.", result));
});

/**
 * GET /payouts/:payoutId — get a single payout (admin).
 */
const getPayout = asyncHandler(async (req, res) => {
    const payout = await getPayoutService({ payoutId: req.params.payoutId });
    return res.status(200).json(new ApiResponse(200, "Payout fetched.", payout));
});

/**
 * PATCH /payouts/:payoutId/approve — admin approves.
 */
const approvePayout = asyncHandler(async (req, res) => {
    const payout = await approvePayoutService({
        payoutId: req.params.payoutId,
        admin: req.user,
        adminNote: req.body.note,
    });
    return res.status(200).json(new ApiResponse(200, "Payout approved.", payout));
});

/**
 * PATCH /payouts/:payoutId/reject — admin rejects.
 */
const rejectPayout = asyncHandler(async (req, res) => {
    const payout = await rejectPayoutService({
        payoutId: req.params.payoutId,
        admin: req.user,
        reason: req.body.reason,
    });
    return res.status(200).json(new ApiResponse(200, "Payout rejected.", payout));
});

/**
 * PATCH /payouts/:payoutId/mark-paid — admin marks as paid (debits wallet).
 */
const markPayoutPaid = asyncHandler(async (req, res) => {
    const payout = await markPayoutPaidService({
        payoutId: req.params.payoutId,
        admin: req.user,
    });
    return res.status(200).json(new ApiResponse(200, "Payout marked as paid.", payout));
});

export {
    requestPayout,
    getMyPayouts,
    getPayouts,
    getPayout,
    approvePayout,
    rejectPayout,
    markPayoutPaid,
};
