/**
 * @file announcement.routes.js
 * @description Routes for the LearnX course announcements module.
 *
 * NOTE: /announcements/feed is registered before /announcements/:announcementId
 * so "feed" isn't treated as an announcement ObjectId.
 */

import { Router } from "express";

import {
    createAnnouncement,
    getCourseAnnouncements,
    getAnnouncement,
    updateAnnouncement,
    publishAnnouncement,
    deleteAnnouncement,
    getStudentFeed,
} from "../controllers/announcement.controller.js";

import {
    createAnnouncementValidator,
    getCourseAnnouncementsValidator,
    getAnnouncementValidator,
    updateAnnouncementValidator,
    publishAnnouncementValidator,
    deleteAnnouncementValidator,
    getStudentFeedValidator,
} from "../validators/announcement.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

/* ── Student: announcement feed (registered before :announcementId) ── */
router.get(
    "/announcements/feed",
    authenticate,
    authorize("student", "instructor", "admin"),
    getStudentFeedValidator,
    validate,
    getStudentFeed
);

/* ── Instructor/admin: management ──────────────────────────────────── */
router.post(
    "/courses/:courseId/announcements",
    authenticate,
    authorize("instructor", "admin"),
    createAnnouncementValidator,
    validate,
    createAnnouncement
);
router.get(
    "/courses/:courseId/announcements",
    authenticate,
    authorize("instructor", "admin"),
    getCourseAnnouncementsValidator,
    validate,
    getCourseAnnouncements
);

/* ── Instructor/admin: by id ───────────────────────────────────────── */
router.get(
    "/announcements/:announcementId",
    authenticate,
    authorize("instructor", "admin"),
    getAnnouncementValidator,
    validate,
    getAnnouncement
);
router.patch(
    "/announcements/:announcementId",
    authenticate,
    authorize("instructor", "admin"),
    updateAnnouncementValidator,
    validate,
    updateAnnouncement
);
router.patch(
    "/announcements/:announcementId/publish",
    authenticate,
    authorize("instructor", "admin"),
    publishAnnouncementValidator,
    validate,
    publishAnnouncement
);
router.delete(
    "/announcements/:announcementId",
    authenticate,
    authorize("instructor", "admin"),
    deleteAnnouncementValidator,
    validate,
    deleteAnnouncement
);

export default router;
