/**
 * @file certificate.service.js
 * @description Certificate service for the LearnX LMS.
 *
 * Issues a certificate when a student reaches 100% completion of a course,
 * then lets students list/read their certificates and lets anyone verify a
 * certificate by its public number.
 *
 *   generateCertificate  -> mints + stores a unique certificate (once per
 *                           student+course) and notifies the student.
 *   getMyCertificates    -> student's certificate list (newest first).
 *   getCertificate       -> single certificate (owner / admin / course owner).
 *   verifyCertificate    -> public, tamper-aware lookup by certificate number.
 */

import Certificate from "../models/certificate.model.js";
import Enrollment from "../models/enrollment.model.js";
import Progress from "../models/progress.model.js";
import Course from "../models/course.model.js";
import User from "../models/user.model.js";

import { ENROLLMENT_STATUS } from "../constants/enrollment.constants.js";
import {
    CERTIFICATE_STATUS,
    CERTIFICATE_MIN_COMPLETION,
} from "../constants/certificate.constants.js";
import { NOTIFICATION_TYPES } from "../constants/notification.constants.js";

import { notifyUser } from "./notification.service.js";
import {
    NotFoundError,
    BadRequestError,
    ForbiddenError,
    ConflictError,
} from "../errors/index.js";
import logger from "../config/logger.js";

/* ────────────────────────────────────────────────────────────────────── */
/*  Issue                                                                ── */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Generate (and persist) a certificate for a completed enrollment.
 *
 * Guards:
 *   - the enrollment must exist and belong to the given student,
 *   - the enrollment must be COMPLETED,
 *   - the course progress must be at 100%,
 *   - only ONE certificate per (student, course) is ever issued
 *     (returns the existing one — idempotent).
 *
 * On success it also pushes a CERTIFICATE_ISSUED in-app notification to the
 * student (best-effort).
 *
 * @param {Object} opts
 * @param {string} opts.enrollmentId
 * @param {string} opts.studentId
 * @param {string} [opts.issuedBy] - admin/instructor _id that minted it (else the system).
 * @returns {Promise<Certificate>}
 */
export const generateCertificate = async ({ enrollmentId, studentId, issuedBy = null }) => {
    const enrollment = await Enrollment.findById(enrollmentId);
    if (!enrollment) throw new NotFoundError("Enrollment not found");

    if (enrollment.student.toString() !== String(studentId)) {
        throw new ForbiddenError("This enrollment does not belong to you.");
    }
    if (enrollment.status !== ENROLLMENT_STATUS.COMPLETED) {
        throw new BadRequestError(
            "Certificate can only be issued for a completed course."
        );
    }

    const [course, progress] = await Promise.all([
        Course.findById(enrollment.course).select("title slug instructor").lean(),
        Progress.findOne({ enrollment: enrollmentId }).lean(),
    ]);
    if (!course) throw new NotFoundError("Course not found");

    if (!progress || (progress.completionPercentage ?? 0) < CERTIFICATE_MIN_COMPLETION) {
        throw new BadRequestError(
            `Course must be ${CERTIFICATE_MIN_COMPLETION}% complete before a certificate is issued.`
        );
    }

    // Already issued? Return the existing certificate (idempotent — no dup).
    const existing = await Certificate.findOne({
        student: studentId,
        course: course._id,
    });
    if (existing) return existing;

    // Resolve instructor display name (best-effort).
    let instructorName = "";
    if (course.instructor) {
        const instructor = await User.findById(course.instructor).select("fullName").lean();
        instructorName = instructor?.fullName || "";
    }

    let certificate = null;
    let attempts = 0;
    // Retry on the (astronomically rare) unique-key collision.
    while (!certificate) {
        attempts += 1;
        if (attempts > 5) {
            throw new ConflictError("Could not allocate a unique certificate number.");
        }
        const certificateNumber = Certificate.generateCertificateNumber();
        const issuedAt = new Date();
        const fingerprint = Certificate.computeFingerprint({
            certificateNumber,
            student: studentId,
            course: course._id,
            issuedAt,
        });

        try {
            certificate = await Certificate.create({
                certificateNumber,
                student: studentId,
                course: course._id,
                enrollment: enrollmentId,
                issueSnapshot: {
                    courseTitle: course.title,
                    courseSlug: course.slug || "",
                    instructorName,
                    completionPercentage: progress.completionPercentage ?? 100,
                    issuedBy,
                },
                status: CERTIFICATE_STATUS.ISSUED,
                issuedAt,
                fingerprint,
            });
        } catch (err) {
            // Recover from a duplicate certificateNumber and try again.
            if (err?.code === 11000 && /certificateNumber/.test(err?.message || "")) {
                continue;
            }
            throw err;
        }
    }

    logger.info(
        `Certificate ${certificate.certificateNumber} issued to ${studentId} for course ${course._id}`
    );

    // Notify the student (best-effort).
    try {
        await notifyUser({
            recipient: studentId,
            type: NOTIFICATION_TYPES.CERTIFICATE_ISSUED,
            title: "You earned a certificate 🎉",
            body: `Congratulations! Your certificate for "${course.title}" is ready.`,
            data: { course: course._id, certificate: certificate._id, certificateNumber: certificate.certificateNumber },
        });
    } catch (e) {
        logger.warn("Certificate notification failed.", { error: e.message });
    }

    return certificate;
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Read (student / owner)                                               ── */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * List a student's certificates (newest first) with pagination.
 *
 * @returns {Promise<{certificates: Certificate[], pagination: Object}>}
 */
export const getMyCertificates = async ({ studentId, page = 1, limit = 10 }) => {
    const filter = { student: studentId, status: CERTIFICATE_STATUS.ISSUED };

    const [certificates, total] = await Promise.all([
        Certificate.find(filter)
            .select("-fingerprint")
            .populate("course", "title slug thumbnail")
            .sort({ issuedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Certificate.countDocuments(filter),
    ]);

    return {
        certificates,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Fetch a single certificate, enforcing visibility:
 *   - the owning student,
 *   - an admin,
 *   - the course's instructor (course ownership).
 *
 * @param {Object} opts { certificateId, user }
 * @returns {Promise<Certificate>}
 */
export const getCertificate = async ({ certificateId, user }) => {
    const certificate = await Certificate.findById(certificateId)
        .select("-fingerprint")
        .populate("course", "title slug thumbnail")
        .populate("student", "fullName email avatar");
    if (!certificate) throw new NotFoundError("Certificate not found");

    // Admin or the owner can always see it.
    if (user.role === "admin" || certificate.student._id.toString() === String(user._id)) {
        return certificate;
    }

    // Course instructor may also view certificates issued for their course.
    if (user.role === "instructor") {
        const course = await Course.findById(certificate.course._id).select("instructor").lean();
        if (course && course.instructor?.toString() === String(user._id)) {
            return certificate;
        }
    }

    throw new ForbiddenError("You are not allowed to view this certificate.");
};

/* ────────────────────────────────────────────────────────────────────── */
/*  Public verification                                                  ── */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Public certificate verification by certificate number.
 *
 * Returns a minimal, public-safe payload (no student email/contact, no
 * fingerprint). It also re-derives the fingerprint from the stored issue
 * payload and rejects the certificate if it doesn't match (tamper check).
 *
 * @param {Object} opts { certificateNumber }
 * @returns {Promise<Object>}
 */
export const verifyCertificate = async ({ certificateNumber }) => {
    const number = String(certificateNumber || "").trim().toUpperCase();
    if (!number) throw new BadRequestError("Certificate number is required.");

    const certificate = await Certificate.findOne({
        certificateNumber: number,
    })
        .populate("course", "title slug")
        .populate("student", "fullName");
    if (!certificate) throw new NotFoundError("Certificate not found.");

    if (certificate.status !== CERTIFICATE_STATUS.ISSUED) {
        throw new BadRequestError("This certificate is no longer valid.");
    }

    // Tamper-evidence check: recompute fingerprint from stored data and compare
    // against the stored fingerprint (needed internally — NOT returned).
    const expected = Certificate.computeFingerprint({
        certificateNumber: certificate.certificateNumber,
        student: certificate.student._id,
        course: certificate.course._id,
        issuedAt: certificate.issuedAt,
    });

    return {
        valid: expected === certificate.fingerprint,
        certificateNumber: certificate.certificateNumber,
        studentName: certificate.student?.fullName || "",
        course: certificate.issueSnapshot?.courseTitle || certificate.course?.title || "",
        issuedAt: certificate.issuedAt,
        issuer: "LearnX AI",
    };
};

export default {
    generateCertificate,
    getMyCertificates,
    getCertificate,
    verifyCertificate,
};
