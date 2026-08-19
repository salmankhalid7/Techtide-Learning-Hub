import { Router } from "express";

import {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  publishCourse,
  archiveCourse,
  deleteCourse,
  getFeaturedCourses,
  getPopularCourses,
  getTrendingCourses,
  getRecommendedCourses,
} from "../controllers/course.controller.js";
import authenticate from "../middlewares/authenticate.js";
import authenticateOptional from "../middlewares/authenticateOptional.js";
import authorize from "../middlewares/authorize.js";
import validate from "../middlewares/validation.middleware.js";
import {
  validateCreateCourse,
  validateUpdateCourse,
  validateCourseId,
  validateCourseFilters,
  validateDiscoveryRail,
} from "../validators/course.validator.js";

const router = Router();

// ── Public Routes ──────────────────────────────────────────

// GET /courses — List courses with optional filtering and pagination.
// Uses optional auth so anonymous browsing still works, while an
// authenticated instructor/admin gets their owner-scoped view (H1).
router.get(
  "/",
  authenticateOptional,
  validateCourseFilters,
  validate,
  getCourses
);

// GET /courses/featured — Merchandised rail (admin/instructor-flagged)
router.get(
  "/featured",
  authenticateOptional,
  validateDiscoveryRail,
  validate,
  getFeaturedCourses
);

// GET /courses/popular — Ranked by enrollments
router.get(
  "/popular",
  authenticateOptional,
  validateDiscoveryRail,
  validate,
  getPopularCourses
);

// GET /courses/trending — Ranked by recent enrollment activity
router.get(
  "/trending",
  authenticateOptional,
  validateDiscoveryRail,
  validate,
  getTrendingCourses
);

// GET /courses/recommended — Personalized for a logged-in student (optional auth)
router.get(
  "/recommended",
  authenticateOptional,
  validateDiscoveryRail,
  validate,
  getRecommendedCourses
);

// GET /courses/:courseId — Get a single course by ID
// NOTE: must stay AFTER the literal rails above so "featured"/"popular" etc.
// are not swallowed as an ObjectId.
router.get(
  "/:courseId",
  validateCourseId,
  validate,
  getCourseById
);

// ── Protected Routes (auth required) ───────────────────────

router.use(authenticate);

// POST /courses — Create a new course (instructors & admins only)
router.post(
  "/",
  authorize("instructor", "admin"),
  validateCreateCourse,
  validate,
  createCourse
);

// PATCH /courses/:courseId — Update a course (instructors & admins only)
router.patch(
  "/:courseId",
  authorize("instructor", "admin"),
  validateUpdateCourse,
  validate,
  updateCourse
);

// PATCH /courses/:courseId/publish — Publish a draft course
router.patch(
  "/:courseId/publish",
  authorize("instructor", "admin"),
  validateCourseId,
  validate,
  publishCourse
);

// PATCH /courses/:courseId/archive — Archive a course
router.patch(
  "/:courseId/archive",
  authorize("instructor", "admin"),
  validateCourseId,
  validate,
  archiveCourse
);

// DELETE /courses/:courseId — Soft-delete a course
router.delete(
  "/:courseId",
  authorize("instructor", "admin"),
  validateCourseId,
  validate,
  deleteCourse
);

export default router;