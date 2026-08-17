/**
 * @file wallet.service.js
 * @description Instructor wallet / earnings queries and adjustments for the
 *              LearnX marketplace finance system.
 *
 * Earnings are credited on paid course sales (net of commission) and debited
 * on refunds and payouts — all via Wallet.transactions. This service exposes
 * read access and admin adjustments.
 */

import mongoose from "mongoose";

import Wallet from "../models/wallet.model.js";

import { TRANSACTION_TYPES, TRANSACTION_DIRECTIONS } from "../constants/payout.constants.js";

import { NotFoundError, BadRequestError } from "../errors/index.js";
import logger from "../config/logger.js";

const getOrCreateWallet = async ({ instructorId }) => {
    let wallet = await Wallet.findOne({ instructor: instructorId });
    if (!wallet) {
        wallet = await Wallet.create({
            instructor: instructorId,
            currency: "USD",
            balance: 0,
        });
    }
    return wallet;
};

/**
 * Get an instructor's wallet with their transaction history.
 */
export const getWallet = async ({ instructorId }) => {
    const wallet = await getOrCreateWallet({ instructorId });
    // Transactions newest-first.
    const transactions = [...(wallet.transactions || [])].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    return { ...wallet.toObject(), transactions };
};

/**
 * Get a paginated view of an instructor's transactions.
 */
export const getTransactions = async ({ instructorId, page = 1, limit = 10 }) => {
    const wallet = await getOrCreateWallet({ instructorId });
    const all = [...(wallet.transactions || [])].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const start = (page - 1) * limit;
    const items = all.slice(start, start + limit);
    return {
        transactions: items,
        pagination: {
            page,
            limit,
            total: all.length,
            totalPages: Math.ceil(all.length / limit),
        },
        balance: wallet.balance,
        totalEarned: wallet.totalEarned,
        totalWithdrawn: wallet.totalWithdrawn,
    };
};

/**
 * Admin: manual credit/debit adjustment to an instructor's wallet.
 */
export const adjustWallet = async ({ adjustmentBy, adjustmentData }) => {
    const { instructorId, amount, direction, description } = adjustmentData;

    if (!mongoose.Types.ObjectId.isValid(instructorId)) {
        throw new BadRequestError("Invalid instructor id.");
    }
    const amountNum = Number(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
        throw new BadRequestError("Amount must be a positive number.");
    }
    if (!Object.values(TRANSACTION_DIRECTIONS).includes(direction)) {
        throw new BadRequestError("Invalid transaction direction.");
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const wallet = await Wallet.findOne({ instructor: instructorId }).session(session);
        if (!wallet) throw new NotFoundError("Wallet not found for this instructor.");

        let newBalance;
        if (direction === TRANSACTION_DIRECTIONS.CREDIT) {
            newBalance = Math.round((wallet.balance + amountNum) * 100) / 100;
        } else {
            const debit = Math.min(amountNum, wallet.balance);
            newBalance = Math.round((wallet.balance - debit) * 100) / 100;
        }

        await Wallet.updateOne(
            { _id: wallet._id },
            {
                $set: { balance: newBalance },
                $push: {
                    transactions: {
                        type: TRANSACTION_TYPES.ADJUSTMENT,
                        direction,
                        amount: amountNum,
                        currency: wallet.currency,
                        balanceAfter: newBalance,
                        description: description || "Manual adjustment",
                        adjustedBy: adjustmentBy,
                        createdAt: new Date(),
                    },
                },
            }
        ).session(session);

        await session.commitTransaction();
        logger.info("Wallet adjusted", { walletId: wallet._id, direction, amountNum });
        return getWallet({ instructorId });
    } catch (error) {
        await session.abortTransaction();
        logger.error("Wallet adjustment failed", { error: error.message });
        throw error;
    } finally {
        await session.endSession();
    }
};
