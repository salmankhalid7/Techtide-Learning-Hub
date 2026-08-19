/**
 * @file certificate.routes.js
 * @description Routes for the LearnX certificate module.
 *
 * ROUTE ORDERING NOTES:
 *  - `/certificates/verify/:certificateNumber` is registered BEFORE
 *    `/certificates/:certificateId` so "verify" isn't parsed as a certificateId.
 *  - `/courses/:courseId/certificates` must be registered (via routes/index.js)
 *    BEFORE courseRouter's authenticate guard, mirroring reviews/announcements.
 */

import { Router } from "express";

import {
    generate,
    myCertificates,
    getOne,
    verify,
} from "../controllers/certificate.controller.js";

import {
    generateValidator,
    myCertificatesValidator,
    getOneValidator,
    verifyValidator,
} from "../validators/certificate.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

/* ── Public verification (no auth) — registered first ─────────────── */
router.get(
    "/certificates/verify/:certificateNumber",
    verifyValidator,
    validate,
    verify
);

/* ── Student: generate for a completed enrollment ─────────────────── */
router.post(
    "/courses/:courseId/certificates",
    authenticate,
    authorize("student", "instructor", "admin"),
    generateValidator,
    validate,
    generate
);

/* ── Student: my certificates ─────────────────────────────────────── */
router.get(
    "/certificates/my",
    authenticate,
    authorize("student", "instructor", "admin"),
    myCertificatesValidator,
    validate,
    myCertificates
);

/* ── Owner / admin / course instructor: single certificate ────────── */
router.get(
    "/certificates/:certificateId",
    authenticate,
    authorize("student", "instructor", "admin"),
    getOneValidator,
    validate,
    getOne
);

export default router;
