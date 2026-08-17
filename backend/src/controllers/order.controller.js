/**
 * @file order.controller.js
 * @description Order controllers for the LearnX marketplace.
 *              Exposes student order history and single order detail.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";

import {
    getOrder as getOrderService,
    getMyOrders as getMyOrdersService,
} from "../services/order.query.service.js";
import { ForbiddenError } from "../errors/index.js";

/**
 * GET /orders/mine
 * The student's own order history.
 */
const getMyOrders = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));

    const result = await getMyOrdersService({ studentId: req.user._id, page, limit });
    return res.status(200).json(new ApiResponse(200, "Orders fetched.", result));
});

/**
 * GET /orders/:orderId
 * Fetch a single order (student owner or admin).
 */
const getOrder = asyncHandler(async (req, res) => {
    const order = await getOrderService({ orderId: req.params.orderId });

    // Students may only view their own orders.
    if (req.user.role !== "admin" && order.student.toString() !== req.user._id.toString()) {
        throw new ForbiddenError("You are not allowed to view this order.");
    }

    return res.status(200).json(new ApiResponse(200, "Order fetched.", order));
});

export { getMyOrders, getOrder };
