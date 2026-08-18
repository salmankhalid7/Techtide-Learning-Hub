/**
 * @file notification.validator.js
 * @description Validators for the LearnX notification routes.
 */

import { body, param, query } from "express-validator";
import mongoose from "mongoose";

const isMongoId = (value) => mongoose.Types.ObjectId.isValid(value);

const getMyNotificationsValidator = [
    query("page").optional().isInt({ min: 1 }).withMessage("Invalid page."),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Invalid limit."),
    query("unread").optional().isBoolean().withMessage("unread must be a boolean."),
];

const notificationIdRule = () => [
    param("notificationId")
        .custom((value) => mongoose.Types.ObjectId.isValid(value))
        .withMessage("Invalid notificationId."),
];

const updatePreferencesValidator = [
    body("email").optional().isBoolean().withMessage("email must be a boolean."),
    body("inApp").optional().isBoolean().withMessage("inApp must be a boolean."),
    body("categories")
        .optional()
        .isObject()
        .withMessage("categories must be an object."),
    body("categories.*")
        .optional()
        .isBoolean()
        .withMessage("Each category toggle must be a boolean."),
];

export {
    getMyNotificationsValidator,
    notificationIdRule,
    updatePreferencesValidator,
};
