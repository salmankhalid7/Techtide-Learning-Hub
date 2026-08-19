/**
 * @file certificate.validator.js
 * @description Validators for the LearnX certificate routes.
 */

import { body, param, query } from "express-validator";
import mongoose from "mongoose";

const isMongoId = (value) => mongoose.Types.ObjectId.isValid(value);

const certificateIdRule = () => [
    param("certificateId").custom(isMongoId).withMessage("Invalid certificateId."),
];

const paginationRule = () => [
    query("page").optional().isInt({ min: 1 }).withMessage("Invalid page."),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Invalid limit."),
];

/**
 * POST /courses/:courseId/certificates
 */
const generateValidator = [
    body("enrollmentId").custom(isMongoId).withMessage("Invalid enrollmentId."),
];

/**
 * GET /certificates/my
 */
const myCertificatesValidator = [...paginationRule()];

/**
 * GET /certificates/:certificateId
 */
const getOneValidator = [...certificateIdRule()];

/**
 * GET /certificates/verify/:certificateNumber
 */
const verifyValidator = [
    param("certificateNumber")
        .trim()
        .notEmpty()
        .withMessage("Certificate number is required.")
        .isLength({ min: 6, max: 40 })
        .withMessage("Invalid certificate number.")
        .matches(/^[A-Za-z0-9-]+$/)
        .withMessage("Certificate number format is invalid."),
];

export {
    generateValidator,
    myCertificatesValidator,
    getOneValidator,
    verifyValidator,
};
