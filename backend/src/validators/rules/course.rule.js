import { body } from "express-validator";

import { DEFAULT_COURSE_LANGUAGE } from "../../constants/course.constants.js";

/**
 * Validates the course title.
 *
 * @returns {import("express-validator").ValidationChain[]}
 */
export const courseTitleRule = () => [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Course title is required.")
    .isLength({ min: 5, max: 120 })
    .withMessage("Course title must be between 5 and 120 characters."),
];

/**
 * Validates the short description.
 *
 * @returns {import("express-validator").ValidationChain[]}
 */
export const shortDescriptionRule = () => [
  body("shortDescription")
    .trim()
    .notEmpty()
    .withMessage("Short description is required.")
    .isLength({ min: 20, max: 300 })
    .withMessage("Short description must be between 20 and 300 characters."),
];

/**
 * Validates the full description.
 *
 * @returns {import("express-validator").ValidationChain[]}
 */
export const descriptionRule = () => [
  body("description")
    .trim()
    .notEmpty()
    .withMessage("Course description is required.")
    .isLength({ min: 50 })
    .withMessage("Course description must be at least 50 characters."),
];

/**
 * Validates course pricing.
 *
 * Note: The discountedPrice < price comparison is handled
 * in the model/service layer, not here.
 *
 * @returns {import("express-validator").ValidationChain[]}
 */
export const coursePriceRule = () => [
  body("pricing.price")
    .isFloat({ min: 0 })
    .withMessage("Course price must be greater than or equal to 0."),
];

/**
 * Validates the course language.
 *
 * @returns {import("express-validator").ValidationChain[]}
 */
export const courseLanguageRule = () => [
  body("courseLanguage")
    .optional()
    .trim()
    .default(DEFAULT_COURSE_LANGUAGE)
    .isString()
    .withMessage("Course language must be a valid string."),
];
