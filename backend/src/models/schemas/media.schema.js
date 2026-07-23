import { Schema } from "mongoose";

/**
 * Reusable sub-schema for Cloudinary media assets.
 *
 * Used by: Course thumbnail, Lesson video, User avatar,
 * certificates, attachments, and any other media-bearing models.
 *
 * @type {Schema}
 */
const mediaSchema = new Schema(
  {
    publicId: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

export default mediaSchema;