import { Schema } from "mongoose";

/**
 * Reusable sub-schema for feature toggles / behaviour flags.
 *
 * Keeps boolean configuration fields organised under a single
 * `settings` key instead of cluttering the root of the model.
 *
 * @type {Schema}
 */
const settingsSchema = new Schema(
  {
    allowReviews: {
      type: Boolean,
      default: true,
    },
    allowDiscussions: {
      type: Boolean,
      default: true,
    },
    certificateEnabled: {
      type: Boolean,
      default: false,
    },
    showInstructor: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

export default settingsSchema;