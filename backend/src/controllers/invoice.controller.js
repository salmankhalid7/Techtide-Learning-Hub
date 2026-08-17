/**
 * @file invoice.controller.js
 * @description Invoice/receipt controllers.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";
import { ForbiddenError } from "../errors/index.js";

import {
    getInvoiceForOrder as getInvoiceForOrderService,
    getMyInvoices as getMyInvoicesService,
} from "../services/invoice.service.js";

/**
 * GET /invoices/mine — student's receipts.
 */
const getMyInvoices = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const result = await getMyInvoicesService({ studentId: req.user._id, page, limit });
    return res.status(200).json(new ApiResponse(200, "Invoices fetched.", result));
});

/**
 * GET /invoices/order/:orderId — fetch the receipt for a specific order.
 * Owner-scoped (student who paid).
 */
const getInvoiceForOrder = asyncHandler(async (req, res) => {
    const invoice = await getInvoiceForOrderService({ orderId: req.params.orderId });

    if (req.user.role !== "admin" && invoice.student.toString() !== req.user._id.toString()) {
        throw new ForbiddenError("You are not allowed to view this invoice.");
    }

    return res.status(200).json(new ApiResponse(200, "Invoice fetched.", invoice));
});

export { getMyInvoices, getInvoiceForOrder };
