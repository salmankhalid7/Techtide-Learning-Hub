/**
 * @file invoice.routes.js
 * @description Routes for the LearnX invoice/receipt system.
 */

import { Router } from "express";

import {
    getMyInvoices,
    getInvoiceForOrder,
} from "../controllers/invoice.controller.js";
import { getOrderValidator } from "../validators/order.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

router.get(
    "/invoices/mine",
    authenticate,
    authorize("student", "instructor", "admin"),
    getMyInvoices
);

router.get(
    "/invoices/order/:orderId",
    authenticate,
    authorize("student", "instructor", "admin"),
    getOrderValidator,
    validate,
    getInvoiceForOrder
);

export default router;
