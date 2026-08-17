/**
 * @file payout.routes.js
 * @description Routes for the LearnX payout/withdrawal workflow.
 */

import { Router } from "express";

import {
    requestPayout,
    getMyPayouts,
    getPayouts,
    getPayout,
    approvePayout,
    rejectPayout,
    markPayoutPaid,
} from "../controllers/payout.controller.js";

import {
    requestPayoutValidator,
    getMyPayoutsValidator,
    getPayoutsValidator,
    getPayoutValidator,
    approvePayoutValidator,
    rejectPayoutValidator,
    markPayoutPaidValidator,
} from "../validators/payout.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

/* Instructor: request + own history. */
router.post(
    "/payouts/request",
    authenticate,
    authorize("instructor", "admin"),
    requestPayoutValidator,
    validate,
    requestPayout
);

router.get(
    "/payouts/mine",
    authenticate,
    authorize("instructor", "admin"),
    getMyPayoutsValidator,
    validate,
    getMyPayouts
);

/* Admin: manage all payouts. */
router.get(
    "/payouts",
    authenticate,
    authorize("admin"),
    getPayoutsValidator,
    validate,
    getPayouts
);

router.get(
    "/payouts/:payoutId",
    authenticate,
    authorize("admin"),
    getPayoutValidator,
    validate,
    getPayout
);

router.patch(
    "/payouts/:payoutId/approve",
    authenticate,
    authorize("admin"),
    approvePayoutValidator,
    validate,
    approvePayout
);

router.patch(
    "/payouts/:payoutId/reject",
    authenticate,
    authorize("admin"),
    rejectPayoutValidator,
    validate,
    rejectPayout
);

router.patch(
    "/payouts/:payoutId/mark-paid",
    authenticate,
    authorize("admin"),
    markPayoutPaidValidator,
    validate,
    markPayoutPaid
);

export default router;
