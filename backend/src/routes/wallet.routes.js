/**
 * @file wallet.routes.js
 * @description Routes for the LearnX instructor wallet/earnings.
 */

import { Router } from "express";

import {
    getMyWallet,
    getMyTransactions,
    adjustWallet,
} from "../controllers/wallet.controller.js";
import { adjustWalletValidator } from "../validators/payout.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

/* Instructor: own wallet. */
router.get(
    "/wallet/mine",
    authenticate,
    authorize("instructor", "admin"),
    getMyWallet
);

router.get(
    "/wallet/mine/transactions",
    authenticate,
    authorize("instructor", "admin"),
    getMyTransactions
);

/* Admin: adjust an instructor's wallet. */
router.post(
    "/wallet/:instructorId/adjust",
    authenticate,
    authorize("admin"),
    adjustWalletValidator,
    validate,
    adjustWallet
);

export default router;
