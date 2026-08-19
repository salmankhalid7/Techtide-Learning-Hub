/**
 * @file certificate.model.js
 * @description Certificate model for the LearnX LMS.
 *
 * A certificate is issued to a student once they reach 100% completion of a
 * course. It carries:
 *   - a unique, human-friendly certificate number (`LRNX-XXXX...`) used in the
 *     public verification flow,
 *   - references to the student, course and enrollment,
 *   - a snapshot of the course title + instructor at issue time (so the
 *     certificate remains valid/displayable even if the course is edited),
 *   - a hash fingerprint over the issue payload (tamper-evidence for the
 *     verification endpoint).
 */

import mongoose from "mongoose";
import crypto from "crypto";

import {
    CERTIFICATE_STATUS,
    CERTIFICATE_NUMBER_PREFIX,
    CERTIFICATE_NUMBER_LENGTH,
} from "../constants/certificate.constants.js";

const { Schema, model } = mongoose;

const certificateSchema = new Schema(
    {
        // Public-facing unique number, e.g. "LRNX-ABC123XYZ4" (see constants).
        certificateNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true,
            uppercase: true,
        },

        student: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        course: {
            type: Schema.Types.ObjectId,
            ref: "Course",
            required: true,
            index: true,
        },
        // The enrollment that generated this certificate (validates completion
        // came from a real, active enrollment).
        enrollment: {
            type: Schema.Types.ObjectId,
            ref: "Enrollment",
            required: true,
            index: true,
        },

        // Snapshot at issue time (kept independent of later course edits).
        issueSnapshot: {
            courseTitle: { type: String, required: true, trim: true },
            courseSlug: { type: String, default: "", trim: true },
            instructorName: { type: String, default: "", trim: true },
            completionPercentage: { type: Number, required: true },
            issuedBy: {
                type: Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
        },

        status: {
            type: String,
            enum: Object.values(CERTIFICATE_STATUS),
            default: CERTIFICATE_STATUS.ISSUED,
            index: true,
        },
        issuedAt: {
            type: Date,
            default: Date.now,
        },
        revokedAt: {
            type: Date,
            default: null,
        },

        // SHA-256 fingerprint over a canonical string of the issue payload.
        // Lets the public verification endpoint confirm a certificate was
        // genuinely minted by this server and not tampered with.
        fingerprint: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
        toJSON: { virtuals: true, transform: _transform },
        toObject: { virtuals: true, transform: _transform },
    }
);

certificateSchema.index({ student: 1, course: 1 }, { unique: true, name: "one_certificate_per_student_course" });
certificateSchema.index({ course: 1, status: 1 });
certificateSchema.index({ student: 1, status: 1 });

/**
 * Generate a human-friendly unique certificate number like "LRNX-ABC123XYZ4".
 * Uses a random base36 string; collision risk is negligible but `unique: true`
 * on the schema still guards against duplicates (caller retries on dup key).
 *
 * @param {string} [prefix] optional prefix override (defaults from constants).
 * @returns {string}
 */
certificateSchema.statics.generateCertificateNumber = function generateCertificateNumber(prefix) {
    const p = prefix || CERTIFICATE_NUMBER_PREFIX;
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid ambiguity
    let out = "";
    for (let i = 0; i < CERTIFICATE_NUMBER_LENGTH; i += 1) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return `${p}-${out}`;
};

/**
 * Compute the tamper-evidence fingerprint for a certificate.
 * Deterministic over { certificateNumber, student, course, issuedAt }.
 *
 * @param {Object} payload
 * @returns {string} hex sha256
 */
certificateSchema.statics.computeFingerprint = function computeFingerprint({ certificateNumber, student, course, issuedAt }) {
    const canonical = [
        certificateNumber,
        String(student),
        String(course),
        new Date(issuedAt).toISOString(),
        CERTIFICATE_STATUS.ISSUED,
    ].join("|");
    return crypto.createHash("sha256").update(canonical).digest("hex");
};

/**
 * JSON transform: expose certificateNumber + issue snapshot, hide fingerprint.
 */
function _transform(_doc, ret) {
    if (ret.fingerprint) delete ret.fingerprint;
    return ret;
}

export default model("Certificate", certificateSchema);
