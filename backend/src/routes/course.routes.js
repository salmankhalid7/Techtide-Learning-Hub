import { Router } from "express";

import * as courseController from "../controllers/course.controller.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";
import validate from "../middlewares/validation.middleware.js";
import {
  validateCreateCourse,
  validateUpdateCourse,
  validateCourseId,
  validateCourseFilters,
} from "../validators/course.validator.js";

const router = Router();

// ── Public Routes ──────────────────────────────────────────

// GET /courses — List courses with optional filtering and pagination
router.get("/", validateCourseFilters, validate, courseController.getCourses);

// GET /courses/:courseId — Get a single course by ID
router.get(
  "/:courseId",
  validateCourseId,
  validate,
  courseController.getCourseById
);

// ── Protected Routes (auth required) ───────────────────────

router.use(authenticate);

// POST /courses — Create a new course (instructors & admins only)
router.post(
  "/",
  authorize("instructor", "admin"),
  validateCreateCourse,
  validate,
  courseController.createCourse
);

// PATCH /courses/:courseId — Update a course (instructors & admins only)
router.patch(
  "/:courseId",
  authorize("instructor", "admin"),
  validateUpdateCourse,
  validate,
  courseController.updateCourse
);

// PATCH /courses/:courseId/publish — Publish a draft course
router.patch(
  "/:courseId/publish",
  authorize("instructor", "admin"),
  validateCourseId,
  validate,
  courseController.publishCourse
);

// PATCH /courses/:courseId/archive — Archive a course
router.patch(
  "/:courseId/archive",
  authorize("instructor", "admin"),
  validateCourseId,
  validate,
  courseController.archiveCourse
);

// DELETE /courses/:courseId — Soft-delete a course
router.delete(
  "/:courseId",
  authorize("instructor", "admin"),
  validateCourseId,
  validate,
  courseController.deleteCourse
);

export default router;