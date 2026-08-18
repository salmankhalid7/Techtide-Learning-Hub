/**
 * @file announcement.service.js
 * @description Course Announcement service for the LearnX LMS.
 *
 * Instructors create/publish announcements for a course; enrolled students
 * see published announcements in a feed. Publishing an announcement notifies
 * all enrolled students (in-app, via notification.service `notifyUsers`).
 */

import Announcement from "../models/announcement.model.js";
import Enrollment from "../models/enrollment.model.js";

import { ANNOUNCEMENT_STATUS } from "../constants/announcement.constants.js";
import { ENROLLMENT_STATUS } from "../constants/enrollment.constants.js";
import { NOTIFICATION_TYPES } from "../constants/notification.constants.js";

import { verifyCourseOwnership } from "../helpers/ownership.helper.js";
import { notifyUsers } from "./notification.service.js";
import {
    NotFoundError,
    BadRequestError,
    ForbiddenError,
} from "../errors/index.js";
import logger from "../config/logger.js";

/**
 * Create a draft announcement for a course (instructor/admin).
 */
export const createAnnouncement = async ({ courseId, user, data }) => {
    const course = await verifyCourseOwnership(courseId, user, "post announcements in this course");

    if (!data.title || !data.body) {
        throw new BadRequestError("Title and body are required.");
    }

    const announcement = await Announcement.create({
        course: courseId,
        instructor: course.instructor,
        title: data.title,
        body: data.body,
        publishAt: data.publishAt || null,
        status: ANNOUNCEMENT_STATUS.DRAFT,
        createdBy: user._id,
    });

    logger.info(`Announcement created (${announcement._id}) for course ${courseId}`);
    return announcement;
};

/**
 * Get a single announcement (owner-scoped at the controller).
 */
export const getAnnouncement = async ({ announcementId }) => {
    const announcement = await Announcement.findById(announcementId).populate("instructor", "fullName username avatar");
    if (!announcement || announcement.deletedAt) {
        throw new NotFoundError("Announcement not found");
    }
    return announcement;
};

/**
 * List a course's announcements (instructor/admin management view).
 */
export const getCourseAnnouncements = async ({ courseId, page = 1, limit = 10, status }) => {
    const filter = { course: courseId };
    if (status) filter.status = status;

    const [announcements, total] = await Promise.all([
        Announcement.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Announcement.countDocuments(filter),
    ]);
    return {
        announcements,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Update an announcement's content (owner/admin; draft or published).
 */
export const updateAnnouncement = async ({ announcementId, user, data }) => {
    const announcement = await _getOwned(announcementId, user);

    if (data.title !== undefined) announcement.title = data.title;
    if (data.body !== undefined) announcement.body = data.body;
    if (data.publishAt !== undefined) announcement.publishAt = data.publishAt;
    announcement.updatedBy = user._id;

    await announcement.save();
    return announcement;
};

/**
 * Publish an announcement and notify enrolled students.
 *
 * Publishing a DRAFT (or re-publishing) sets status=PUBLISHED + publishedAt,
 * then pushes a NEW_ANNOUNCEMENT notification to every ACTIVE enrollment of
 * the course.
 */
export const publishAnnouncement = async ({ announcementId, user }) => {
    const announcement = await _getOwned(announcementId, user);

    // Honor a scheduled publishAt in the future? We publish immediately here;
    // if publishAt is in the future, treat it as publish-at that time via a
    // note (a scheduler is out of scope; publish is immediate).
    const wasPublished = announcement.status === ANNOUNCEMENT_STATUS.PUBLISHED;
    announcement.status = ANNOUNCEMENT_STATUS.PUBLISHED;
    announcement.publishedAt = new Date();
    announcement.updatedBy = user._id;
    await announcement.save();

    // Notify enrolled students (skip if it was already published once).
    if (!wasPublished) {
        await _notifyEnrolledStudents(announcement);
    }

    return announcement;
};

/**
 * Soft-delete an announcement (owner/admin).
 */
export const deleteAnnouncement = async ({ announcementId, user }) => {
    const announcement = await _getOwned(announcementId, user);
    announcement.deletedAt = new Date();
    await announcement.save();
    return { deleted: true, announcementId };
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Student feed                                                          */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * A student's announcement feed: published announcements across all their
 * enrolled courses (optionally scoped to one course), newest first.
 */
export const getStudentFeed = async ({ studentId, courseId = null, page = 1, limit = 10 }) => {
    // The courses the student is enrolled in.
    const enrolled = await Enrollment.find({
        student: studentId,
        status: ENROLLMENT_STATUS.ACTIVE,
    }).select("course").lean();
    const enrolledCourseIds = enrolled.map((e) => e.course);

    // If a specific course is requested, the student must be enrolled in it.
    if (courseId && !enrolledCourseIds.some((c) => c.toString() === String(courseId))) {
        throw new ForbiddenError("You are not enrolled in this course.");
    }

    if (enrolledCourseIds.length === 0) {
        return { announcements: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }

    const filter = {
        course: { $in: enrolledCourseIds },
        status: ANNOUNCEMENT_STATUS.PUBLISHED,
        deletedAt: null,
    };
    if (courseId) {
        filter.course = courseId;
    }

    const [announcements, total] = await Promise.all([
        Announcement.find(filter)
            .populate("course", "title slug")
            .populate("instructor", "fullName username avatar")
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Announcement.countDocuments(filter),
    ]);

    return {
        announcements,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                */
/* ────────────────────────────────────────────────────────────────────── */

const _getOwned = async (announcementId, user) => {
    const announcement = await Announcement.findById(announcementId);
    if (!announcement || announcement.deletedAt) {
        throw new NotFoundError("Announcement not found");
    }

    if (user.role !== "admin" && announcement.instructor.toString() !== user._id.toString()) {
        throw new ForbiddenError("You are not allowed to manage this announcement.");
    }
    return announcement;
};

/**
 * Notify all ACTIVE-enrolled students of the course about the announcement.
 */
const _notifyEnrolledStudents = async (announcement) => {
    try {
        const enrolled = await Enrollment.find({
            course: announcement.course,
            status: ENROLLMENT_STATUS.ACTIVE,
        }).select("student").lean();

        const recipients = enrolled.map((e) => e.student);
        if (recipients.length === 0) return;

        await notifyUsers({
            recipients,
            type: NOTIFICATION_TYPES.NEW_ANNOUNCEMENT,
            title: announcement.title || "New announcement",
            body: announcement.body?.slice?.(0, 200) || "",
            data: { course: announcement.course, announcement: announcement._id },
            actor: announcement.instructor,
        });
    } catch (e) {
        logger.warn("Announcement notification failed.", { error: e.message });
    }
};
