import mongoose from "mongoose";

const { Schema } = mongoose;
/**
 * Quiz lifecycle.
 */
const QUIZ_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
});

/**
 * Supported question types.
 */
const QUESTION_TYPES = Object.freeze({
  MCQ_SINGLE: "MCQ_SINGLE",
  MCQ_MULTIPLE: "MCQ_MULTIPLE",
  TRUE_FALSE: "TRUE_FALSE",
  SHORT_ANSWER: "SHORT_ANSWER",
  LONG_ANSWER: "LONG_ANSWER",
  FILL_BLANK: "FILL_BLANK",
  MATCHING: "MATCHING",
  ORDERING: "ORDERING",
});

/**
 * Question difficulty.
 */
const QUESTION_DIFFICULTY = Object.freeze({
  EASY: "EASY",
  MEDIUM: "MEDIUM",
  HARD: "HARD",
});

/**
 * Supported attachment types.
 */
const ATTACHMENT_TYPES = Object.freeze({
  IMAGE: "IMAGE",
  PDF: "PDF",
  VIDEO: "VIDEO",
  AUDIO: "AUDIO",
  FILE: "FILE",
  LINK: "LINK",
});

const QUIZ_STATUS_VALUES = Object.values(QUIZ_STATUS);

const QUESTION_TYPE_VALUES = Object.values(QUESTION_TYPES);

const QUESTION_DIFFICULTY_VALUES = Object.values(
  QUESTION_DIFFICULTY
);

const ATTACHMENT_TYPE_VALUES = Object.values(
  ATTACHMENT_TYPES
);

/**
 * @description Stores files attached to a question.
 */
const attachmentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ATTACHMENT_TYPE_VALUES,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },

    url: {
      type: String,
      required: true,
      trim: true,
    },

    publicId: {
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
 * @description Represents a single answer option.
 */
const optionSchema = new Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    value: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      default: null,
      trim: true,
    },

    order: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    _id: false,
  }
);

/**
 * @description Structured answer storage. The populated field(s) depend on
 * the question type — validation should be enforced at the service layer.
 *
 * - MCQ_SINGLE / TRUE_FALSE / SHORT_ANSWER / FILL_BLANK → `value`
 * - MCQ_MULTIPLE / ORDERING                       → `values[]`
 * - MATCHING                                       → `pairs[]`
 * - LONG_ANSWER                                    → `rubric[]`
 * - FILL_BLANK (multiple alternatives)             → `acceptableValues[]`
 */
const answerSchema = new Schema(
  {
    value: { type: String, default: null },
    values: { type: [String], default: [] },
    pairs: {
      type: [{ left: { type: String }, right: { type: String } }],
      default: [],
    },
    rubric: {
      type: [{ criterion: { type: String }, maxPoints: { type: Number } }],
      default: [],
    },
    acceptableValues: { type: [String], default: [] },
  },
  { _id: false }
);

/**
 * @description Represents a quiz question.
 */
const questionSchema = new Schema(
  {
    type: {
      type: String,
      enum: QUESTION_TYPE_VALUES,
      required: true,
    },

    questionId: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
      immutable: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    options: {
      type: [optionSchema],
      default: [],
    },

    correctAnswer: {
      type: answerSchema,
      default: () => ({}),
    },

    marks: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    difficulty: {
      type: String,
      enum: QUESTION_DIFFICULTY_VALUES,
      default: QUESTION_DIFFICULTY.MEDIUM,
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

    tags: {
      type: [String],
      default: [],
    },

    image: {
      type: String,
      default: null,
      trim: true,
    },

    codeSnippet: {
      type: String,
      default: "",
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    order: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    _id: true,
  }
);

/**
 * @description Configuration settings for a quiz.
 */
const quizSettingsSchema = new Schema(
  {
    passingPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 50,
    },

    timeLimitType: {
      type: String,
      enum: ["UNLIMITED", "LIMITED"],
      default: "UNLIMITED",
    },

    timeLimit: {
      type: Number,
      min: 0,
      default: 0,
    },

    attemptsAllowed: {
      type: Number,
      min: 1,
      default: 1,
    },

    shuffleQuestions: {
      type: Boolean,
      default: false,
    },

    shuffleOptions: {
      type: Boolean,
      default: false,
    },

    randomQuestionPool: {
      type: Number,
      min: 0,
      default: 0,
    },

    negativeMarking: {
      enabled: {
        type: Boolean,
        default: false,
      },

      value: {
        type: Number,
        min: 0,
        default: 0,
      },
    },

    instantFeedback: {
      type: Boolean,
      default: false,
    },

    showCorrectAnswers: {
      type: Boolean,
      default: true,
    },
  },
  {
    _id: false,
  }
);

/**
 * @description Controls quiz availability.
 */
const availabilitySchema = new Schema(
  {
    availableFrom: {
      type: Date,
      default: null,
    },

    availableUntil: {
      type: Date,
      default: null,
    },

    isScheduled: {
      type: Boolean,
      default: false,
    },

    publishAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);

/**
 * @description Quiz analytics.
 */
const statisticsSchema = new Schema(
  {
    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageScore: {
      type: Number,
      default: 0,
      min: 0,
    },

    completionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    _id: false,
  }
);

/**
 * @description Main Quiz schema.
 */
const quizSchema = new Schema(
  {
    // ===========================
    // Relationships
    // ===========================

    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },

    module: {
      type: Schema.Types.ObjectId,
      ref: "Module",
      required: true,
    },

    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ===========================
    // Basic Information
    // ===========================

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    instructions: {
      type: String,
      default: "",
      trim: true,
    },

    // ===========================
    // Quiz Content
    // ===========================

    questions: {
      type: [questionSchema],
      default: [],
    },

    // ===========================
    // Configuration
    // ===========================

    settings: {
      type: quizSettingsSchema,
      default: () => ({}),
    },

    availability: {
      type: availabilitySchema,
      default: () => ({}),
    },

    statistics: {
      type: statisticsSchema,
      default: () => ({}),
    },

    // ===========================
    // Ordering
    // ===========================

    order: {
      type: Number,
      required: true,
      min: 1,
    },

    // ===========================
    // Lifecycle
    // ===========================

    status: {
      type: String,
      enum: QUIZ_STATUS_VALUES,
      default: QUIZ_STATUS.DRAFT,
    },

    version: {
      type: Number,
      default: 1,
      min: 1,
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
    },

    // ===========================
    // Audit
    // ===========================

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
  }
);

/**
 * ==========================================
 * Database Indexes
 * ==========================================
 */

// Lookup indexes
quizSchema.index({ course: 1 });
quizSchema.index({ module: 1 });
quizSchema.index({ instructor: 1 });
quizSchema.index({ status: 1 });

// Searching
quizSchema.index({ instructor: 1, slug: 1 }, { unique: true });

// Soft Delete
quizSchema.index({ deletedAt: 1 });

// Prevent duplicate ordering (active quizzes only)
quizSchema.index(
  { module: 1, order: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
    },
  }
);

// Text search for instructor dashboards and admin search
quizSchema.index({
  title: "text",
  description: "text",
});

/**
 * ==========================================
 * Virtuals
 * ==========================================
 */

quizSchema.virtual("questionCount").get(function () {
  return this.questions.length;
});

quizSchema.virtual("isPublished").get(function () {
  return this.status === "PUBLISHED";
});

quizSchema.virtual("isDeleted").get(function () {
  return this.deletedAt !== null;
});

/**
 * ==========================================
 * Middleware
 * ==========================================
 */

/**
 * Normalize question tags before validation.
 */
quizSchema.pre("validate", function () {
  this.questions.forEach((question) => {
    question.tags = [...new Set(question.tags.map((tag) => tag.trim().toLowerCase()))];
  });
});

/**
 * Increment version on update.
 */
quizSchema.pre("save", function () {
  if (!this.isNew && this.isModified()) {
    this.version += 1;
  }
});

/**
 * Automatically exclude soft-deleted quizzes from queries.
 */
quizSchema.pre(/^find/, function () {
  this.where({ deletedAt: null });
});

/**
 * ==========================================
 * Export
 * ==========================================
 */

const Quiz = mongoose.model("Quiz", quizSchema);

export default Quiz;
export { QUIZ_STATUS, QUESTION_TYPES, QUESTION_DIFFICULTY, ATTACHMENT_TYPES };