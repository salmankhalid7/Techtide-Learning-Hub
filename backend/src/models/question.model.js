/**
 * @file question.model.js
 * @description Mongoose model for quiz questions.
 *
 * Architecture:
 * Course
 *   └── Module
 *        └── Quiz
 *             └── Question
 *
 * Design decisions:
 * - Reuses mediaSchema (publicId + url) for the `images` array.
 * - Keeps question-specific sub-schemas inline because the shared
 *   settings.schema.js is course-oriented and not generic enough.
 * - No pre('save') middleware — order and stats logic lives in
 *   question.service.js (consistent with the architecture).
 */

import mongoose from "mongoose";
import mediaSchema from "./schemas/media.schema.js";

import {
  QUESTION_TYPES,
  DIFFICULTY_LEVELS,
} from "../constants/question.constants.js";

const { Schema } = mongoose;

/* -------------------------------------------------------------------------- */
/*                               Sub Schemas                                  */
/* -------------------------------------------------------------------------- */

/**
 * Single answer option for MCQ / TRUE_FALSE questions.
 */
const optionSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/**
 * External resource (link) attached to a question.
 */
const resourceSchema = new Schema(
  {
    title: {
      type: String,
      trim: true,
    },

    url: {
      type: String,
      trim: true,
    },
  },
  {
    _id: false,
  }
);

/**
 * Optional code block displayed alongside the question.
 */
const codeSnippetSchema = new Schema(
  {
    language: {
      type: String,
      trim: true,
    },

    code: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
  }
);

/**
 * Behaviour flags scoped to this question.
 * Not to be confused with the course-level settings.schema.js.
 */
const questionSettingsSchema = new Schema(
  {
    shuffleOptions: {
      type: Boolean,
      default: false,
    },

    caseSensitive: {
      type: Boolean,
      default: false,
    },

    partialCredit: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  }
);

/* -------------------------------------------------------------------------- */
/*                               Main Schema                                  */
/* -------------------------------------------------------------------------- */

const questionSchema = new Schema(
  {
    quiz: {
      type: Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
      index: true,
    },

    title: {
      type: String,
      trim: true,
      required: true,
    },

    questionText: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      enum: Object.values(QUESTION_TYPES),
      index: true,
    },

    order: {
      type: Number,
      required: true,
      min: 1,
    },

    options: {
      type: [optionSchema],
      default: [],
    },

    correctAnswers: {
      type: [Schema.Types.Mixed],
      default: [],
    },

    explanation: {
      type: String,
      trim: true,
      default: "",
    },

    hint: {
      type: String,
      trim: true,
      default: "",
    },

    marks: {
      type: Number,
      required: true,
      min: 0,
    },

    negativeMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    difficulty: {
      type: String,
      enum: Object.values(DIFFICULTY_LEVELS),
      default: DIFFICULTY_LEVELS.MEDIUM,
      index: true,
    },

    estimatedTime: {
      type: Number,
      default: 60,
      min: 0,
    },

    tags: {
      type: [String],
      default: [],
    },

    images: {
      type: [mediaSchema],
      default: [],
    },

    attachments: {
      type: [mediaSchema],
      default: [],
    },

    externalResources: {
      type: [resourceSchema],
      default: [],
    },

    codeSnippet: {
      type: codeSnippetSchema,
      default: () => ({}),
    },

    settings: {
      type: questionSettingsSchema,
      default: () => ({}),
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    minimize: false,
  }
);

/* -------------------------------------------------------------------------- */
/*                                  Indexes                                   */
/* -------------------------------------------------------------------------- */

// Fast listing inside a quiz (excludes soft-deleted questions to avoid
// order collisions when _getNextOrder ignores deletedAt !== null docs)
questionSchema.index(
  { quiz: 1, order: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  }
);

// Filtering
questionSchema.index({ quiz: 1, deletedAt: 1 });

questionSchema.index({ quiz: 1, type: 1 });

questionSchema.index({ quiz: 1, difficulty: 1 });

questionSchema.index({ tags: 1 });

/* -------------------------------------------------------------------------- */
/*                                  Virtuals                                  */
/* -------------------------------------------------------------------------- */

questionSchema.virtual("isPublished").get(function () {
  return !!this.publishedAt && !this.archivedAt && !this.deletedAt;
});

questionSchema.virtual("isArchived").get(function () {
  return !!this.archivedAt;
});

questionSchema.virtual("isDeleted").get(function () {
  return !!this.deletedAt;
});

/* -------------------------------------------------------------------------- */
/*                              Schema Options                                */
/* -------------------------------------------------------------------------- */

questionSchema.set("toJSON", {
  virtuals: true,
});

questionSchema.set("toObject", {
  virtuals: true,
});

/* -------------------------------------------------------------------------- */

export default mongoose.model("Question", questionSchema);