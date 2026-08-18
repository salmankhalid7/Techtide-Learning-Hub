/**
 * @file announcement.controller.js
 * @description Controllers for the LearnX course announcements module.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";
import { ForbiddenError } from "../errors/index.js";

import {
    createAnnouncement as createAnnouncementService,
    getAnnouncement as getAnnouncementService,
    getCourseAnnouncements as getCourseAnnouncementsService,
    updateAnnouncement as updateAnnouncementService,
    publishAnnouncement as publishAnnouncementService,
    deleteAnnouncement as deleteAnnouncementService,
    getStudentFeed as getStudentFeedService,
} from "../services/announcement.service.js";

/* ── Instructor: management ─────────────────────────────────────────── */

/**
 * POST /courses/:courseId/announcements
 */
const createAnnouncement = asyncHandler(async (req, res) => {
    const announcement = await createAnnouncementService({
        courseId: req.params.courseId,
        user: req.user,
        data: req.body,
    });
    return res.status(201).json(new ApiResponse(201, "Announcement created.", announcement));
});

/**
 * GET /courses/:courseId/announcements  (instructor management view)
 */
const getCourseAnnouncements = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const result = await getCourseAnnouncementsService({
        courseId: req.params.courseId,
        page,
        limit,
        status: req.query.status,
    });
    return res.status(200).json(new ApiResponse(200, "Announcements fetched.", result));
});

/**
 * GET /announcements/:announcementId  (owner or admin)
 */
const getAnnouncement = asyncHandler(async (req, res) => {
    const announcement = await getAnnouncementService({ announcementId: req.params.announcementId });
    if (req.user.role !== "admin" && announcement.instructor.toString() !== req.user._id.toString()) {
        throw new ForbiddenError("You are not allowed to view this announcement.");
    }
    return res.status(200).json(new ApiResponse(200, "Announcement fetched.", announcement));
});

/**
 * PATCH /announcements/:announcementId
 */
const updateAnnouncement = asyncHandler(async (req, res) => {
    const announcement = await updateAnnouncementService({
        announcementId: req.params.announcementId,
        user: req.user,
        data: req.body,
    });
    return res.status(200).json(new ApiResponse(200, "Announcement updated.", announcement));
});

/**
 * PATCH /announcements/:announcementId/publish
 */
const publishAnnouncement = asyncHandler(async (req, res) => {
    const announcement = await publishAnnouncementService({
        announcementId: req.params.announcementId,
        user: req.user,
    });
    return res.status(200).json(new ApiResponse(200, "Announcement published.", announcement));
});

/**
 * DELETE /announcements/:announcementId
 */
const deleteAnnouncement = asyncHandler(async (req, res) => {
    const result = await deleteAnnouncementService({
        announcementId: req.params.announcementId,
        user: req.user,
    });
    return res.status(200).json(new ApiResponse(200, "Announcement deleted.", result));
});

/* ── Student: feed ──────────────────────────────────────────────────── */

/**
 * GET /announcements/feed
 */
const getStudentFeed = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const result = await getStudentFeedService({
        studentId: req.user._id,
        courseId: req.query.courseId || null,
        page,
        limit,
    });
    return res.status(200).json(new ApiResponse(200, "Announcement feed fetched.", result));
});

export {
    createAnnouncement,
    getCourseAnnouncements,
    getAnnouncement,
    updateAnnouncement,
    publishAnnouncement,
    deleteAnnouncement,
    getStudentFeed,
};
