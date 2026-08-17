/**
 * @file order.query.service.js
 * @description Read-side queries for orders and payments in the LearnX
 *              marketplace (separate from the write-side order.service.js).
 */

import Order from "../models/order.model.js";
import Payment from "../models/payment.model.js";

import { NotFoundError } from "../errors/index.js";

/**
 * Get a single order with its payment + item course populated.
 */
export const getOrder = async ({ orderId }) => {
    const order = await Order.findById(orderId)
        .populate("payment")
        .populate("student", "name email")
        .populate("items.course", "title slug pricing");
    if (!order) throw new NotFoundError("Order not found");
    return order;
};

/**
 * Get a student's order history.
 */
export const getMyOrders = async ({ studentId, page = 1, limit = 10 }) => {
    const [orders, total] = await Promise.all([
        Order.find({ student: studentId })
            .populate("payment")
            .populate("items.course", "title slug pricing")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Order.countDocuments({ student: studentId }),
    ]);
    return {
        orders,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Get payments for a student (history of charge attempts).
 */
export const getMyPayments = async ({ studentId, page = 1, limit = 10 }) => {
    const [payments, total] = await Promise.all([
        Payment.find({ student: studentId })
            .populate("order")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Payment.countDocuments({ student: studentId }),
    ]);
    return { payments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};
