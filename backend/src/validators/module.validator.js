import { body, param } from "express-validator";

import { objectIdRule } from "./rules/objectId.rule.js";
import { nameRule } from "./rules/name.rule.js";


/**
 * Validate module creation request
 */
export const createModuleValidator = [
    body("course")
        .notEmpty()
        .withMessage("Course ID is required")
        .bail()
        .custom(objectIdRule),

    body("title")
        .trim()
        .notEmpty()
        .withMessage("Module title is required")
        .bail()
        .isLength({ min: 3, max: 150 })
        .withMessage(
            "Module title must be between 3 and 150 characters"
        ),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage(
            "Description cannot exceed 1000 characters"
        ),

    body("order")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "Order must be a positive integer"
        ),

    body("estimatedDuration")
        .optional()
        .isInt({ min: 0 })
        .withMessage(
            "Estimated duration must be a positive number"
        ),

    body("isPreview")
        .optional()
        .isBoolean()
        .withMessage(
            "isPreview must be a boolean value"
        ),
];


/**
 * Validate module update request
 */
export const updateModuleValidator = [
    param("moduleId")
        .custom(objectIdRule),

    body("title")
        .optional()
        .trim()
        .isLength({ min: 3, max: 150 })
        .withMessage(
            "Module title must be between 3 and 150 characters"
        ),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage(
            "Description cannot exceed 1000 characters"
        ),

    body("order")
        .optional()
        .isInt({ min: 1 })
        .withMessage(
            "Order must be a positive integer"
        ),

    body("estimatedDuration")
        .optional()
        .isInt({ min: 0 })
        .withMessage(
            "Estimated duration must be a positive number"
        ),
];


/**
 * Validate module ID parameter
 */
export const moduleIdValidator = [
    param("moduleId")
        .custom(objectIdRule),
];

/**
 * Validate module reorder request
 */
export const reorderModuleValidator = [
    body("courseId")
        .notEmpty()
        .withMessage("Course ID is required")
        .bail()
        .custom(objectIdRule),


    body("modules")
        .isArray({ min: 1 })
        .withMessage(
            "Modules must be a non-empty array"
        ),


    body("modules.*.moduleId")
        .notEmpty()
        .withMessage(
            "Module ID is required"
        )
        .bail()
        .custom(objectIdRule),


    body("modules.*.order")
        .isInt({ min: 1 })
        .withMessage(
            "Module order must be a positive integer"
        ),
];

