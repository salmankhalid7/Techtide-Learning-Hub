/**
 * @file order.validator.js
 * @description Validators for the LearnX order routes.
 */

import { param, query } from "express-validator";
import mongoose from "mongoose";

const isMongoId = (value) => mongoose.Types.ObjectId.isValid(value);

const getMyOrdersValidator = [
    query("page").optional().isInt({ min: 1 }).withMessage("Invalid page."),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Invalid limit."),
];

const getOrderValidator = [
    param("orderId").custom(isMongoId).withMessage("Invalid orderId."),
];

export { getMyOrdersValidator, getOrderValidator };
