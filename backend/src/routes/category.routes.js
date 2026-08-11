import { Router } from "express";

import {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";
import authenticateOptional from "../middlewares/authenticateOptional.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";
import validate from "../middlewares/validation.middleware.js";
import {
  validateCreateCategory,
  validateUpdateCategory,
  validateCategoryId,
} from "../validators/category.validator.js";

const router = Router();

// ── Public Routes ──────────────────────────────────────────
// Optional auth lets admins see inactive categories too (via includeInactive).

// GET /categories — List categories (active ones for the public)
router.get(
  "/",
  authenticateOptional,
  listCategories
);

// GET /categories/:categoryId — Get a single category by ID
router.get(
  "/:categoryId",
  authenticateOptional,
  validateCategoryId,
  validate,
  getCategoryById
);

// ── Admin Routes ───────────────────────────────────────────

// POST /categories — Create a category (admin only)
router.post(
  "/",
  authenticate,
  authorize("admin"),
  validateCreateCategory,
  validate,
  createCategory
);

// PATCH /categories/:categoryId — Update a category (admin only)
router.patch(
  "/:categoryId",
  authenticate,
  authorize("admin"),
  validateUpdateCategory,
  validate,
  updateCategory
);

// DELETE /categories/:categoryId — Soft-delete a category (admin only)
router.delete(
  "/:categoryId",
  authenticate,
  authorize("admin"),
  validateCategoryId,
  validate,
  deleteCategory
);

export default router;