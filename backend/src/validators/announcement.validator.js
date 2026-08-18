/**
 * @file announcement.validator.js
 * @description Validators for the LearnX course announcements routes.
 */

import { body, param, query } from "express-validator";
import mongoose from "mongoose";

import { ANNOUNCEMENT_STATUS } from "../constants/announcement.constants.js";

const isMongoId = (value) => mongoose.Types.ObjectId.isValid(value);

const courseIdRule = () => [
    param("courseId").custom(isMongoId).withMessage("Invalid courseId."),
];

const announcementIdRule = () => [
    param("announcementId").custom(isMongoId).withMessage("Invalid announcementId."),
];

const paginationRule = () => [
    query("page").optional().isInt({ min: 1 }).withMessage("Invalid page."),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Invalid limit."),
];

/**
 * POST /courses/:courseId/announcements
 */
const createAnnouncementValidator = [
    ...courseIdRule(),
    body("title").trim().notEmpty().withMessage("Title is required.").isLength({ max: 200 }),
    body("body").trim().notEmpty().withMessage("Body is required.").isLength({ max: 10000 }),
    body("publishAt").optional().isISO8601().withMessage("Invalid publishAt date."),
];

/**
 * GET /courses/:courseId/announcements
 */
const getCourseAnnouncementsValidator = [
    ...courseIdRule(),
    ...paginationRule(),
    query("status")
        .optional()
        .isIn(Object.values(ANNOUNCEMENT_STATUS))
        .withMessage("Invalid status."),
];

/**
 * GET /announcements/:announcementId
 */
const getAnnouncementValidator = [...announcementIdRule()];

/**
 * PATCH /announcements/:announcementId
 */
const updateAnnouncementValidator = [
    ...announcementIdRule(),
    body("title").optional().trim().notEmpty().withMessage("Title cannot be empty.").isLength({ max: 200 }),
    body("body").optional().trim().notEmpty().withMessage("Body cannot be empty.").isLength({ max: 10000 }),
    body("publishAt").optional({ nullable: true }).isISO8601().withMessage("Invalid publishAt date."),
];

/**
 * PATCH /announcements/:announcementId/publish
 */
const publishAnnouncementValidator = [...announcementIdRule()];

/**
 * DELETE /announcements/:announcementId
 */
const deleteAnnouncementValidator = [...announcementIdRule()];

/**
 * GET /announcements/feed
 */
const getStudentFeedValidator = [
    ...paginationRule(),
    query("courseId").optional().custom(isMongoId).withMessage("Invalid courseId."),
];

export {
    createAnnouncementValidator,
    getCourseAnnouncementsValidator,
    getAnnouncementValidator,
    updateAnnouncementValidator,
    publishAnnouncementValidator,
    deleteAnnouncementValidator,
    getStudentFeedValidator,
};
