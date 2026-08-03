/**
 * @file enrollment.routes.js
 * @description Routes for enrollment management.
 */

import { Router } from "express";

import * as enrollmentController from "../controllers/enrollment.controller.js";
import {
    enrollStudentValidator,
    getEnrollmentValidator,
    getMyEnrollmentsValidator,
    dropEnrollmentValidator,
} from "../validators/enrollment.validator.js";

import authenticate from "../middlewares/authenticate.js";

const router = Router();

/* -------------------------------------------------------------------------- */
/*                               Enrollment                                   */
/* -------------------------------------------------------------------------- */

router.post(
    "/courses/:courseId/enroll",
    authenticate,
    enrollStudentValidator,
    enrollmentController.enrollStudent
);

router.get(
    "/courses/:courseId/enrollment",
    authenticate,
    getEnrollmentValidator,
    enrollmentController.getEnrollment
);

router.get(
    "/enrollments",
    authenticate,
    getMyEnrollmentsValidator,
    enrollmentController.getMyEnrollments
);

router.patch(
    "/enrollments/:enrollmentId/drop",
    authenticate,
    dropEnrollmentValidator,
    enrollmentController.dropEnrollment
);

export default router;