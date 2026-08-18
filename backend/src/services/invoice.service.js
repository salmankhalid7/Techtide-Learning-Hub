/**
 * @file invoice.service.js
 * @description Invoice/receipt generation and retrieval for the LearnX
 *              marketplace.
 *
 * A receipt is generated (idempotently) when a paid order is confirmed. It is a
 * financial snapshot and is never mutated after issue.
 */

import Invoice from "../models/invoice.model.js";
import Order from "../models/order.model.js";
import Payment from "../models/payment.model.js";

import { PAYMENT_STATUS } from "../constants/payment.constants.js";
import { ORDER_STATUS } from "../constants/order.constants.js";

import { NotFoundError } from "../errors/index.js";
import logger from "../config/logger.js";
import { config } from "../config/index.js";
import { COMMISSION } from "../constants/payment.constants.js";

/**
 * Generate (or return an existing) invoice for a paid order.
 */
export const generateInvoice = async ({ orderId, force = false }) => {
    const existing = await Invoice.findOne({ order: orderId });
    if (existing && !force) return existing;

    const order = await Order.findById(orderId).populate("payment");
    if (!order) throw new NotFoundError("Order not found");
    if (order.status !== ORDER_STATUS.PAID) {
        throw new NotFoundError("Invoice is only available for paid orders.");
    }

    const payment = order.payment || null;
    const item = order.items && order.items[0];
    const commissionRatePercent = Number(
        config.payment?.commissionRatePercent ?? COMMISSION.DEFAULT_RATE_PERCENT
    );
    const unitPrice = item ? Number(item.unitPrice || 0) : 0;
    const instructorNet = Math.round(unitPrice * (1 - commissionRatePercent / 100) * 100) / 100;
    const commission = Math.round((unitPrice - instructorNet) * 100) / 100;

    const data = {
        invoiceNumber: _makeInvoiceNumber(order._id.toString()),
        order: order._id,
        payment: payment ? payment._id : null,
        student: order.student,
        instructor: item ? item.instructor : null,
        currency: order.money.currency,
        items: item
            ? [
                  {
                      itemType: "course",
                      course: item.course,
                      courseTitle: item.courseTitle || "",
                      unitPrice,
                      quantity: item.quantity || 1,
                  },
              ]
            : [],
        subtotal: order.money.subtotal,
        discount: order.money.discount,
        total: order.money.total,
        commission,
        commissionRatePercent,
        instructorNet,
        provider: payment ? payment.provider : "",
        providerTransactionId: payment ? payment.providerTransactionId : "",
        status: "paid",
        issuedAt: new Date(),
    };

    if (existing && force) {
        await Invoice.updateOne({ _id: existing._id }, { $set: data });
        logger.info("Invoice regenerated", { orderId });
        return Invoice.findOne({ order: orderId });
    }

    const created = await Invoice.create(data);
    logger.info("Invoice generated", { orderId, invoiceNumber: created.invoiceNumber });
    return created;
};

/**
 * Get an invoice for an order (student/owner-scoped at the controller).
 */
export const getInvoiceForOrder = async ({ orderId }) => {
    const invoice = await Invoice.findOne({ order: orderId });
    if (!invoice) throw new NotFoundError("Invoice not found");
    return invoice;
};

/**
 * List a student's invoices.
 */
export const getMyInvoices = async ({ studentId, page = 1, limit = 10 }) => {
    const [invoices, total] = await Promise.all([
        Invoice.find({ student: studentId })
            .sort({ issuedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Invoice.countDocuments({ student: studentId }),
    ]);
    return {
        invoices,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

const _makeInvoiceNumber = (orderId) => {
    const short = orderId.slice(-8).toUpperCase();
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `LXR-${y}${m}-${short}`;
};
