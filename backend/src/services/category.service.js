/**
 * @file category.service.js
 * @description Business logic for Category operations.
 *
 * Architecture:
 *   Route → Validator → Controller → Category Service → Category Model → MongoDB
 *
 * Responsibilities:
 *   - Database interaction (list / get / create / update / soft-delete)
 *   - Slug generation (handled by the model pre-validate hook)
 *   - Authorization (writes are admin-only)
 *
 * This layer never knows about Express. It throws ApiError subclasses which
 * the global error middleware turns into HTTP responses.
 */

import Category from "../models/category.model.js";
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
} from "../errors/index.js";

// Fields a client is allowed to set.
const ALLOWED_CREATE_FIELDS = ["name", "description", "icon"];
const ALLOWED_UPDATE_FIELDS = ["name", "description", "icon", "isActive"];

/**
 * Admin-only guard for category writes.
 */
const requireAdmin = (user) => {
  if (user?.role !== "admin") {
    throw new ForbiddenError("Only admins can manage categories.");
  }
};

/**
 * List categories (public).
 * Returns active, non-deleted categories ordered by name. Supports optional
 * `includeInactive=true` for admins (admin-only view of disabled categories).
 */
const listCategories = async (query = {}, user) => {
  const filter = {};
  const isAdmin = user?.role === "admin";

  // Anonymous/students only see active categories. Admins may include
  // inactive ones by passing includeInactive=true.
  // `$ne: false` (instead of `isActive: true`) keeps categories that predate
  // this model (missing `isActive`) visible — "active unless explicitly off".
  if (!(isAdmin && query.includeInactive === "true")) {
    filter.isActive = { $ne: false };
  }

  // Pagination
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const [categories, totalCategories] = await Promise.all([
    Category.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Category.countDocuments(filter),
  ]);

  return {
    categories,
    pagination: {
      totalCategories,
      currentPage: page,
      totalPages: Math.ceil(totalCategories / limit) || 1,
      limit,
    },
  };
};

/**
 * Get a single category by id (public, active only; admins may fetch any).
 */
const getCategoryById = async (categoryId, user) => {
  const category = await Category.findById(categoryId);

  if (!category) {
    throw new NotFoundError("Category not found.");
  }

  // Non-admins cannot read disabled categories directly. A missing `isActive`
  // (legacy doc) is treated as active.
  if (user?.role !== "admin" && category.isActive === false) {
    throw new NotFoundError("Category not found.");
  }

  return category;
};

/**
 * Create a category (admin only).
 */
const createCategory = async (data, user) => {
  requireAdmin(user);

  const payload = {};
  ALLOWED_CREATE_FIELDS.forEach((field) => {
    if (data[field] !== undefined) payload[field] = data[field];
  });

  if (!payload.name) {
    throw new BadRequestError("Category name is required.");
  }

  const category = await Category.create(payload);
  return category;
};

/**
 * Update a category (admin only).
 */
const updateCategory = async (categoryId, data, user) => {
  requireAdmin(user);

  const category = await Category.findById(categoryId);
  if (!category) {
    throw new NotFoundError("Category not found.");
  }

  ALLOWED_UPDATE_FIELDS.forEach((field) => {
    if (data[field] !== undefined) category[field] = data[field];
  });

  await category.save();
  return category;
};

/**
 * Soft-delete a category (admin only).
 * Marks it as deleted so it no longer appears in default find queries, but
 * preserves the historical category association on existing courses.
 */
const deleteCategory = async (categoryId, user) => {
  requireAdmin(user);

  const category = await Category.findById(categoryId);
  if (!category) {
    throw new NotFoundError("Category not found.");
  }

  category.isDeleted = true;
  category.deletedAt = new Date();
  category.isActive = false;

  await category.save();

  return { id: categoryId, deleted: true };
};

const categoryService = {
  listCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};

export default categoryService;
