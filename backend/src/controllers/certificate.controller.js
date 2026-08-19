/**
 * @file certificate.controller.js
 * @description Controllers for the LearnX certificate module.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/apiResponse.js";

import {
    generateCertificate,
    getMyCertificates,
    getCertificate,
    verifyCertificate,
} from "../services/certificate.service.js";

/**
 * Generate a certificate for a completed enrollment.
 *
 * POST /courses/:courseId/certificates
 * Generates for the authenticated student's completed enrollment in that course.
 */
const generate = asyncHandler(async (req, res) => {
    const enrollmentId = req.body.enrollmentId;
    const certificate = await generateCertificate({
        enrollmentId,
        studentId: req.user._id,
        issuedBy: req.user._id,
    });
    return res.status(201).json(new ApiResponse(201, "Certificate generated.", certificate));
});

/**
 * List the authenticated student's certificates.
 *
 * GET /certificates/my
 */
const myCertificates = asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
    const result = await getMyCertificates({
        studentId: req.user._id,
        page,
        limit,
    });
    return res.status(200).json(new ApiResponse(200, "Certificates fetched.", result));
});

/**
 * Get a single certificate (owner / admin / course instructor).
 *
 * GET /certificates/:certificateId
 */
const getOne = asyncHandler(async (req, res) => {
    const certificate = await getCertificate({
        certificateId: req.params.certificateId,
        user: req.user,
    });
    return res.status(200).json(new ApiResponse(200, "Certificate fetched.", certificate));
});

/**
 * Public certificate verification by number.
 *
 * GET /certificates/verify/:certificateNumber  (no auth required)
 * e.g. /certificates/verify/LRNX-ABC123XYZ4
 */
const verify = asyncHandler(async (req, res) => {
    const result = await verifyCertificate({
        certificateNumber: req.params.certificateNumber,
    });
    return res.status(200).json(new ApiResponse(200, "Certificate verified.", result));
});

export {
    generate,
    myCertificates,
    getOne,
    verify,
};
