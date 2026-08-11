/**
 * @file category.model.js
 * @description Category model for LearnX AI LMS.
 *
 * Organizes courses into browsable categories (e.g. "Web Development",
 * "Machine Learning"). Soft-deleted via `isDeleted` to match the Course and
 * Lesson convention, so deleted categories no longer appear in listings but
 * their historical association with courses remains intact.
 */

import mongoose from "mongoose";
import slugify from "slugify";

const { Schema, model } = mongoose;

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required."],
      trim: true,
      minlength: [2, "Category name must be at least 2 characters."],
      maxlength: [80, "Category name cannot exceed 80 characters."],
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [300, "Category description cannot exceed 300 characters."],
      default: "",
    },

    icon: {
      type: String,
      trim: true,
      maxlength: [200, "Category icon reference cannot exceed 200 characters."],
      default: "",
    },

    // Categories can be disabled without being deleted.
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ── Soft Delete ──────────────────────────────────────
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ────────────────────────────────────────────────────────────
// Indexes
// ────────────────────────────────────────────────────────────

// Browseable categories list (active, not deleted) ordered by name.
categorySchema.index({ isDeleted: 1, isActive: 1, name: 1 });

// ────────────────────────────────────────────────────────────
// Pre-Validate Middleware — Slug Generation
// ────────────────────────────────────────────────────────────

/**
 * Generates a unique slug from the name before validation.
 * Appends a numeric suffix (e.g. `web-dev-1`) if the base slug is taken.
 */
categorySchema.pre("validate", async function () {
  if (!this.isModified("name") && this.slug) return;

  const baseSlug = slugify(this.name, {
    lower: true,
    strict: true,
    trim: true,
  });

  let candidate = baseSlug;
  let counter = 0;

  // NOTE: include isDeleted via the raw collection to avoid the find
  // middleware hiding soft-deleted docs — the unique slug index still
  // contains them, so they must count toward uniqueness.
  while (
    await model("Category").exists({
      slug: candidate,
      _id: { $ne: this._id },
      isDeleted: { $in: [true, false] },
    })
  ) {
    counter += 1;
    candidate = `${baseSlug}-${counter}`;
  }

  this.slug = candidate;
});

// ────────────────────────────────────────────────────────────
// Query Middleware — Soft Delete
// ────────────────────────────────────────────────────────────

// Exclude soft-deleted categories from all find queries by default.
categorySchema.pre(/^find/, function () {
  if (!this.getQuery().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

const Category = model("Category", categorySchema);

export default Category;
