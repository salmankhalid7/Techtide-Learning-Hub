/**
 * @file tag.model.js
 * @description Tag model for LearnX AI LMS.
 *
 * Tags attach to courses (Course.tags is an array of Tag ObjectIds) to power
 * advanced discovery filtering (e.g. `?tags=...`). This model was missing
 * even though the Course schema references a "Tag" ref — added so Mongoose
 * `populate("tags", ...)` and tag-based course queries work consistently.
 *
 * Soft-deleted via `isDeleted` to match the Category/Course convention.
 */

import mongoose from "mongoose";
import slugify from "slugify";

const { Schema, model } = mongoose;

const tagSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Tag name is required."],
      trim: true,
      minlength: [2, "Tag name must be at least 2 characters."],
      maxlength: [60, "Tag name cannot exceed 60 characters."],
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
      maxlength: [200, "Tag description cannot exceed 200 characters."],
      default: "",
    },

    // Tags can be disabled without being deleted.
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

tagSchema.index({ isActive: 1, name: 1 });

/**
 * Pre-validate: generate a unique slug from the name.
 */
tagSchema.pre("validate", async function () {
  if (!this.isModified("name") && this.slug) return;

  const baseSlug = slugify(this.name, {
    lower: true,
    strict: true,
    trim: true,
  });

  let candidate = baseSlug;
  let counter = 0;

  // Include soft-deleted docs via raw query so the unique slug index (which
  // still contains them) counts toward uniqueness.
  while (
    await model("Tag").exists({
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

// Exclude soft-deleted tags from find queries by default.
tagSchema.pre(/^find/, function () {
  if (!this.getQuery().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

const Tag = model("Tag", tagSchema);

export default Tag;
