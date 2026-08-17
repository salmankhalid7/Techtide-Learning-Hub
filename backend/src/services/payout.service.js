/**
 * @file payout.service.js
 * @description Instructor payout / withdrawal workflow for the LearnX
 *              marketplace.
 *
 * Manual approval workflow (confirmed by the client):
 *   1. instructor requests a payout (PENDING).
 *   2. admin approves (APPROVED).
 *   3. admin marks it PAID — the wallet is debited and a WITHDRAWAL transaction
 *      is recorded.
 *   An admin may also reject with a reason.
 *
 * Security: instructors can only request payouts against their own wallet, up
 * to their available balance, and never more than once per duplicate request.
 */

import mongoose from "mongoose";

import Payout from "../models/payout.model.js";
import Wallet from "../models/wallet.model.js";

import { PAYOUT_STATUS } from "../constants/payout.constants.js";
import { TRANSACTION_TYPES, TRANSACTION_DIRECTIONS } from "../constants/payout.constants.js";

import { NotFoundError, BadRequestError, ForbiddenError } from "../errors/index.js";
import logger from "../config/logger.js";

/**
 * An instructor requests a withdrawal from their wallet.
 */
export const requestPayout = async ({ instructorId, data }) => {
    const amount = Number(data.amount);
    if (Number.isNaN(amount) || amount <= 0) {
        throw new BadRequestError("Payout amount must be a positive number.");
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const wallet = await Wallet.findOne({ instructor: instructorId }).session(session);
        if (!wallet) throw new NotFoundError("No wallet found for this instructor.");
        if (amount > wallet.balance) {
            throw new BadRequestError("Requested amount exceeds available wallet balance.");
        }

        // Block a duplicate pending payout of the same amount.
        const dup = await Payout.findOne({
            instructor: instructorId,
            status: { $in: [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.APPROVED] },
        }).session(session);
        if (dup) {
            throw new BadRequestError("You already have a pending payout request.");
        }

        const payout = await Payout.create(
            [
                {
                    instructor: instructorId,
                    amount,
                    currency: wallet.currency,
                    status: PAYOUT_STATUS.PENDING,
                    method: data.method || "Bank Transfer",
                    accountDetails: data.accountDetails || "",
                    events: [{ type: "requested", note: "Payout requested" }],
                },
            ],
            { session }
        );

        await session.commitTransaction();
        return payout[0];
    } catch (error) {
        await session.abortTransaction();
        logger.error("Payout request failed", { instructorId, error: error.message });
        throw error;
    } finally {
        await session.endSession();
    }
};

/**
 * Instructor: list their own payouts with history.
 */
export const getMyPayouts = async ({ instructorId, page = 1, limit = 10 }) => {
    const [payouts, total] = await Promise.all([
        Payout.find({ instructor: instructorId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Payout.countDocuments({ instructor: instructorId }),
    ]);
    return {
        payouts,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Admin: list all payout requests (optionally by status).
 */
export const getPayouts = async ({ page = 1, limit = 10, status }) => {
    const filter = {};
    if (status) filter.status = status;

    const [payouts, total] = await Promise.all([
        Payout.find(filter)
            .populate("instructor", "name email")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Payout.countDocuments(filter),
    ]);
    return {
        payouts,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Admin: get a single payout.
 */
export const getPayout = async ({ payoutId }) => {
    const payout = await Payout.findById(payoutId).populate("instructor", "name email");
    if (!payout) throw new NotFoundError("Payout not found");
    return payout;
};

/**
 * Admin: approve a pending payout.
 */
export const approvePayout = async ({ payoutId, admin, adminNote }) => {
    const payout = await Payout.findById(payoutId);
    if (!payout) throw new NotFoundError("Payout not found");
    if (payout.status !== PAYOUT_STATUS.PENDING) {
        throw new BadRequestError("Only pending payouts can be approved.");
    }

    payout.status = PAYOUT_STATUS.APPROVED;
    payout.approvedBy = admin._id;
    payout.approvedAt = new Date();
    payout.adminNote = adminNote || payout.adminNote;
    payout.events.push({ type: "approved", by: admin._id, note: "Approved" });
    await payout.save();

    logger.info("Payout approved", { payoutId });
    return payout;
};

/**
 * Admin: reject a pending payout.
 */
export const rejectPayout = async ({ payoutId, admin, reason }) => {
    const payout = await Payout.findById(payoutId);
    if (!payout) throw new NotFoundError("Payout not found");
    if (payout.status !== PAYOUT_STATUS.PENDING) {
        throw new BadRequestError("Only pending payouts can be rejected.");
    }

    payout.status = PAYOUT_STATUS.REJECTED;
    payout.rejectedBy = admin._id;
    payout.rejectedAt = new Date();
    payout.rejectionReason = reason || "";
    payout.events.push({ type: "rejected", by: admin._id, note: reason || "Rejected" });
    await payout.save();

    logger.info("Payout rejected", { payoutId });
    return payout;
};

/**
 * Admin: mark an approved payout as PAID — debits the instructor wallet.
 */
export const markPayoutPaid = async ({ payoutId, admin }) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const payout = await Payout.findById(payoutId).session(session);
        if (!payout) throw new NotFoundError("Payout not found");
        if (payout.status !== PAYOUT_STATUS.APPROVED) {
            throw new BadRequestError("Only approved payouts can be marked as paid.");
        }

        const wallet = await Wallet.findOne({ instructor: payout.instructor }).session(session);
        if (!wallet) throw new NotFoundError("Wallet not found for this instructor.");
        if (payout.amount > wallet.balance) {
            throw new BadRequestError("Insufficient wallet balance to pay out.");
        }

        const newBalance = Math.round((wallet.balance - payout.amount) * 100) / 100;
        await Wallet.updateOne(
            { _id: wallet._id },
            {
                $set: { balance: newBalance },
                $inc: { totalWithdrawn: payout.amount },
                $push: {
                    transactions: {
                        type: TRANSACTION_TYPES.WITHDRAWAL,
                        direction: TRANSACTION_DIRECTIONS.DEBIT,
                        amount: payout.amount,
                        currency: wallet.currency,
                        balanceAfter: newBalance,
                        payout: payout._id,
                        description: `Payout #${payout._id}`,
                        createdAt: new Date(),
                    },
                },
            }
        ).session(session);

        payout.status = PAYOUT_STATUS.PAID;
        payout.paidBy = admin._id;
        payout.paidAt = new Date();
        payout.transaction = wallet._id;
        payout.events.push({ type: "paid", by: admin._id, note: "Marked as paid" });
        await payout.save({ session });

        await session.commitTransaction();
        return payout;
    } catch (error) {
        await session.abortTransaction();
        logger.error("Mark payout paid failed", { payoutId, error: error.message });
        throw error;
    } finally {
        await session.endSession();
    }
};
