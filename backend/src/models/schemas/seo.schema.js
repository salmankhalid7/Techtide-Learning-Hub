import { Schema } from "mongoose";

/**
 * Reusable sub-schema for SEO metadata.
 *
 * Used by: Course, Category, and any other content
 * that needs search-engine optimisation fields.
 *
 * @type {Schema}
 */
const seoSchema = new Schema(
  {
    metaTitle: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: 320,
    },
    keywords: {
      type: [String],
      set: (tags) => tags.map((t) => t.toLowerCase().trim()),
    },
  },
  { _id: false }
);

export default seoSchema;