import mongoose from "mongoose";
import slugify from "slugify";

import mediaSchema from "./schemas/media.schema.js";
import seoSchema from "./schemas/seo.schema.js";
import settingsSchema from "./schemas/settings.schema.js";

import {
  COURSE_LEVELS,
  COURSE_STATUS,
  COURSE_VISIBILITY,
  COURSE_CURRENCIES,
  DEFAULT_COURSE_LANGUAGE,
} from "../constants/course.constants.js";

const { Schema, model } = mongoose;

// ────────────────────────────────────────────────────────────
// Pricing Sub-Schema
// ────────────────────────────────────────────────────────────

/**
 * Embedded pricing object.
 *
 * Supports free courses (price = 0) and paid courses with
 * an optional discounted price for promotions.
 */
const pricingSchema = new Schema(
  {
    currency: {
      type: String,
      enum: Object.values(COURSE_CURRENCIES),
      default: COURSE_CURRENCIES.USD,
    },
    price: {
      type: Number,
      required: [true, "Course price is required."],
      min: [0, "Price cannot be negative."],
      default: 0,
    },
    discountedPrice: {
      type: Number,
      min: [0, "Discounted price cannot be negative."],
    },
  },
  { _id: false }
);

// ────────────────────────────────────────────────────────────
// Statistics Sub-Schema (read-only counters)
// ────────────────────────────────────────────────────────────

/**
 * Denormalised counters updated via hooks / aggregation.
 * Avoids counting queries on every read.
 */
const statisticsSchema = new Schema(
  {
    totalEnrollments: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Marketplace: number of paid course sales. Incremented on each completed
    // paid purchase (not free enrollments).
    totalSales: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    // Rating distribution keyed by star count (1..5) onto the number of
    // approved reviews. Derived by the review service whenever a review is
    // approved/rejected/deleted/updated.
    ratingDistribution: {
      type: Schema.Types.Mixed,
      default: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    totalDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalLessons: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalModules: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

// ────────────────────────────────────────────────────────────
// Course Schema
// ────────────────────────────────────────────────────────────

/**
 * Course Model
 *
 * Stores course metadata.
 * Learning content (modules, lessons, quizzes) lives in
 * separate collections referenced by this model.
 *
 * Indexes:         slug (unique), instructor, category, status + visibility
 * Middleware:      auto-slug generation, publish-date handling, soft-delete
 * Virtuals:        isFree, isPublished, ratingDisplay
 */
const courseSchema = new Schema(
  {
    // ── Basic Information ────────────────────────────────

    title: {
      type: String,
      required: [true, "Course title is required."],
      trim: true,
      minlength: [5, "Title must be at least 5 characters."],
      maxlength: [120, "Title cannot exceed 120 characters."],
      index: true,
    },

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    shortDescription: {
      type: String,
      required: [true, "Short description is required."],
      trim: true,
      minlength: [20, "Short description must be at least 20 characters."],
      maxlength: [300, "Short description cannot exceed 300 characters."],
    },

    description: {
      type: String,
      required: [true, "Course description is required."],
      trim: true,
      minlength: [50, "Description must be at least 50 characters."],
    },

    courseLanguage: {
      type: String,
      trim: true,
      default: DEFAULT_COURSE_LANGUAGE,
    },

    level: {
      type: String,
      enum: {
        values: Object.values(COURSE_LEVELS),
        message: "{VALUE} is not a valid course level.",
      },
      default: COURSE_LEVELS.BEGINNER,
    },

    // ── Ownership & Categorisation ──────────────────────

    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Course must have an instructor."],
      index: true,
    },

    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },

    tags: [
      {
        type: Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],

    // ── Media ───────────────────────────────────────────

    thumbnail: mediaSchema,

    previewVideo: mediaSchema,

    // ── Pricing ─────────────────────────────────────────

    pricing: {
      type: pricingSchema,
      required: true,
      default: () => ({}),
    },

    // ── Status & Visibility ─────────────────────────────

    status: {
      type: String,
      enum: {
        values: Object.values(COURSE_STATUS),
        message: "{VALUE} is not a valid course status.",
      },
      default: COURSE_STATUS.DRAFT,
      index: true,
    },

    visibility: {
      type: String,
      enum: {
        values: Object.values(COURSE_VISIBILITY),
        message: "{VALUE} is not a valid visibility option.",
      },
      default: COURSE_VISIBILITY.PUBLIC,
    },

    publishedAt: {
      type: Date,
    },

    // ── Discovery / Merchandising ────────────────────────

    featured: {
      type: Boolean,
      default: false,
      index: true,
      // Admin/instructor flag: featured courses surface on the marketplace
      // home ("Featured" rail) ahead of the general listing.
    },

    // ── SEO ─────────────────────────────────────────────

    seo: seoSchema,

    // ── Settings ────────────────────────────────────────

    settings: {
      type: settingsSchema,
      default: () => ({}),
    },

    // ── Statistics (denormalised) ───────────────────────

    statistics: {
      type: statisticsSchema,
      default: () => ({}),
    },

    // ── Versioning & Soft Delete ────────────────────────

    version: {
      type: Number,
      default: 1,
      min: 1,
    },

    lastMajorUpdate: {
      type: Date,
      default: Date.now,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
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

courseSchema.index({ status: 1, visibility: 1 });
courseSchema.index({ instructor: 1, status: 1 });
courseSchema.index({ instructor: 1, createdAt: -1 });
courseSchema.index({ category: 1, status: 1 });
courseSchema.index({ "statistics.averageRating": -1 });
courseSchema.index({ tags: 1 });
courseSchema.index({ featured: 1, status: 1, visibility: 1 });

// Text index for full-text search across title, shortDescription, and description.
courseSchema.index(
  { title: "text", shortDescription: "text", description: "text" },
  {
    weights: { title: 10, shortDescription: 5, description: 3 },
    name: "course_search_index",
  }
);

// ────────────────────────────────────────────────────────────
// Virtuals
// ────────────────────────────────────────────────────────────

courseSchema.virtual("isFree").get(function () {
  return this.pricing?.price === 0;
});

courseSchema.virtual("isPublished").get(function () {
  return this.status === COURSE_STATUS.PUBLISHED;
});

courseSchema.virtual("isDiscounted").get(function () {
  const { price, discountedPrice } = this.pricing ?? {};
  return discountedPrice != null && discountedPrice < price;
});

// ────────────────────────────────────────────────────────────
// Pre-Validate Middleware — Slug Generation
// ────────────────────────────────────────────────────────────

/**
 * Generates a unique slug from the title before validation.
 *
 * If the base slug already exists in the collection a numeric
 * suffix is appended (e.g. `my-course-1`, `my-course-2`).
 */
courseSchema.pre("validate", async function () {
  // Mongoose 9+: async pre hooks do NOT receive a `next` callback.
  // Return a promise instead — Mongoose waits for it to resolve.
  if (!this.isModified("title") && this.slug) return;

  const baseSlug = slugify(this.title, {
    lower: true,
    strict: true,
    trim: true,
  });

  let candidate = baseSlug;
  let counter = 0;

  // NOTE: must include `isDeleted: { $in: [true, false] }` so the soft-delete
  // query middleware does NOT hide soft-deleted docs — the unique slug index
  // still contains them, so they must count toward uniqueness.
  while (
    await mongoose.model("Course").exists({
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
// Pre-Save Middleware
// ────────────────────────────────────────────────────────────

courseSchema.pre("save", function () {
  // Mongoose 9+: pre hooks do NOT receive a `next` callback.
  // Throw to abort, or return to continue.

  // ── Set publishedAt when transitioning to published ──
  if (this.isModified("status") && this.status === COURSE_STATUS.PUBLISHED && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // ── Validate discountedPrice ≤ price ───────────
  const { price, discountedPrice } = this.pricing ?? {};
  if (discountedPrice != null && discountedPrice >= price) {
    throw new Error("Discounted price must be less than the original price.");
  }
});

// ────────────────────────────────────────────────────────────
// Query Middleware — Soft Delete
// ────────────────────────────────────────────────────────────

courseSchema.pre(/^find/, function () {
  // Exclude soft-deleted documents by default
  // NOTE: Query middleware does not receive a `next` callback.
  if (!this.getQuery().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

// ────────────────────────────────────────────────────────────
// Export
// ────────────────────────────────────────────────────────────

const Course = model("Course", courseSchema);

export default Course;