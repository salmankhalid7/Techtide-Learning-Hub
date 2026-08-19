/**
 * @file certificate.constants.js
 * @description Constants for the LearnX certificate system.
 */

/**
 * Certificate statuses.
 *  - ISSUED: the certificate has been granted to a student.
 *  - REVOKED: the certificate was revoked (rare; e.g. enrollment reversed).
 */
const CERTIFICATE_STATUS = Object.freeze({
    ISSUED: "ISSUED",
    REVOKED: "REVOKED",
});

/**
 * Minimum course completion percentage required before a certificate is issued.
 * Completion is validated against this threshold when generating a certificate;
 * students must reach 100% to earn a certificate for a course.
 */
const CERTIFICATE_MIN_COMPLETION = 100;

/**
 * Length of the human-friendly unique certificate number (excluding the
 * "LRNX-" prefix). The number itself is random, base36 (A-Z, 0-9).
 */
const CERTIFICATE_NUMBER_LENGTH = 10;

/**
 * Human-friendly prefix for public certificate numbers, e.g. LRNX-ABC123XYZ4.
 */
const CERTIFICATE_NUMBER_PREFIX = "LRNX";

export {
    CERTIFICATE_STATUS,
    CERTIFICATE_MIN_COMPLETION,
    CERTIFICATE_NUMBER_LENGTH,
    CERTIFICATE_NUMBER_PREFIX,
};
