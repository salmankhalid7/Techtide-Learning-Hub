/**
 * @file order.routes.js
 * @description Routes for the LearnX order history.
 */

import { Router } from "express";

import { getMyOrders, getOrder } from "../controllers/order.controller.js";
import { getMyOrdersValidator, getOrderValidator } from "../validators/order.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

router.get(
    "/orders/mine",
    authenticate,
    authorize("student", "instructor", "admin"),
    getMyOrdersValidator,
    validate,
    getMyOrders
);

router.get(
    "/orders/:orderId",
    authenticate,
    authorize("student", "instructor", "admin"),
    getOrderValidator,
    validate,
    getOrder
);

export default router;
