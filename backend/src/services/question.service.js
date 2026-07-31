/**
 * @file question.service.js
 * @description Business logic for Question operations.
 *
 * Architecture
 * ─────────────
 *   Route → Validator → Controller → Question Service → Question Model → MongoDB
 *
 * Responsibilities
 * ────────────────
 *   • Type-specific business validation (option counts, matching pairs, etc.)
 *   • Database interaction (with transactions for multi-document writes)
 *   • Ownership verification
 *   • Ordering logic
 *   • Soft delete & reindex
 *   • Quiz statistics (totalQuestions, totalMarks) kept in sync
 *
 * This layer never knows about Express (req, res, next).
 * It throws ApiError subclasses — the global error middleware
 * handles the HTTP response.
 */

import mongoose from "mongoose";
import Question from "../models/question.model.js";
import Quiz from "../models/quiz.model.js";
import Module from "../models/module.model.js";
import {
  QUESTION_TYPES,
  DIFFICULTY_LEVELS,
} from "../constants/question.constants.js";
import { verifyCourseOwnership } from "../helpers/ownership.helper.js";
import { NotFoundError, BadRequestError } from "../errors/index.js";
import { getPagination, getPaginationMeta } from "../utils/pagination.js";
import logger from "../config/logger.js";

/* -------------------------------------------------------------------------- */
/*                          Active Record Filter                              */
/* -------------------------------------------------------------------------- */

/** Excludes soft-deleted records from all queries. */
const ACTIVE_FILTER = { deletedAt: null };

/* -------------------------------------------------------------------------- */
/*                    Common Option Validation                                 */
/* -------------------------------------------------------------------------- */

/**
 * Checks for duplicate option IDs and duplicate option text within an array.
 *
 * @param {Array} options
 * @throws {BadRequestError}
 */
const _validateNoDuplicateOptions = (options) => {
  if (!options || options.length < 2) return;

  const ids = options.map((o) => o.id).filter(Boolean);
  if (ids.length !== new Set(ids).size) {
    throw new BadRequestError("Duplicate option IDs are not allowed.");
  }

  const texts = options.map((o) => o.text?.trim().toLowerCase()).filter(Boolean);
  if (texts.length !== new Set(texts).size) {
    throw new BadRequestError("Duplicate option text is not allowed.");
  }
};

/* -------------------------------------------------------------------------- */
/*                    Type-Specific Business Validation                       */
/* -------------------------------------------------------------------------- */

/**
 * Validates a MULTIPLE_CHOICE_SINGLE question.
 * - Exactly one correct answer must be selected.
 * - The correct answer value must exist in the options array.
 *
 * @param {Object} data
 * @throws {BadRequestError}
 */
const validateMCQSingle = (data) => {
  const { options, correctAnswers } = data;

  if (!options || options.length < 2) {
    throw new BadRequestError(
      "MCQ (Single) requires at least 2 options."
    );
  }

  _validateNoDuplicateOptions(options);

  if (!correctAnswers || correctAnswers.length !== 1) {
    throw new BadRequestError(
      "MCQ (Single) requires exactly 1 correct answer."
    );
  }

  const optionIds = options.map((o) => o.id);
  if (!optionIds.includes(correctAnswers[0])) {
    throw new BadRequestError(
      "Correct answer must match one of the provided option IDs."
    );
  }
};

/**
 * Validates a MULTIPLE_CHOICE_MULTIPLE question.
 * - At least two correct answers must be selected.
 * - All correct answer values must exist in the options array.
 * - Correct answers must not contain duplicates.
 *
 * @param {Object} data
 * @throws {BadRequestError}
 */
const validateMCQMultiple = (data) => {
  const { options, correctAnswers } = data;

  if (!options || options.length < 2) {
    throw new BadRequestError(
      "MCQ (Multiple) requires at least 2 options."
    );
  }

  _validateNoDuplicateOptions(options);

  if (!correctAnswers || correctAnswers.length < 2) {
    throw new BadRequestError(
      "MCQ (Multiple) requires at least 2 correct answers."
    );
  }

  const optionIds = options.map((o) => o.id);
  for (const answer of correctAnswers) {
    if (!optionIds.includes(answer)) {
      throw new BadRequestError(
        `Correct answer "${answer}" must match one of the provided option IDs.`
      );
    }
  }

  if (new Set(correctAnswers).size !== correctAnswers.length) {
    throw new BadRequestError("Duplicate correct answers are not allowed.");
  }
};

/**
 * Validates a TRUE_FALSE question.
 * - Exactly 2 options with standardised True / False identifiers.
 * - Exactly 1 correct answer referencing one of the two option IDs.
 *
 * @param {Object} data
 * @throws {BadRequestError}
 */
const validateTrueFalse = (data) => {
  const { options, correctAnswers } = data;

  if (!options || options.length !== 2) {
    throw new BadRequestError(
      "True/False requires exactly 2 options."
    );
  }

  // Enforce standard True / False identifiers
  const trueOpt = options.find(
    (o) => o.id?.toLowerCase() === "true" || o.text?.toLowerCase() === "true"
  );
  const falseOpt = options.find(
    (o) => o.id?.toLowerCase() === "false" || o.text?.toLowerCase() === "false"
  );

  if (!trueOpt || !falseOpt) {
    throw new BadRequestError(
      'True/False question must have options labelled "True" and "False".'
    );
  }

  if (!correctAnswers || correctAnswers.length !== 1) {
    throw new BadRequestError(
      "True/False requires exactly 1 correct answer."
    );
  }

  const optionIds = options.map((o) => o.id);
  if (!optionIds.includes(correctAnswers[0])) {
    throw new BadRequestError(
      "Correct answer must match one of the provided option IDs."
    );
  }
};

/**
 * Validates a SHORT_ANSWER question.
 * - No options array needed.
 * - Requires at least 1 correct answer value.
 *
 * @param {Object} data
 * @throws {BadRequestError}
 */
const validateShortAnswer = (data) => {
  const { correctAnswers } = data;

  if (!correctAnswers || correctAnswers.length < 1) {
    throw new BadRequestError(
      "Short answer requires at least 1 acceptable answer."
    );
  }

  if (correctAnswers.some((a) => !a || (typeof a === "string" && !a.trim()))) {
    throw new BadRequestError(
      "Each correct answer must be a non-empty value."
    );
  }
};

/**
 * Validates a LONG_ANSWER question.
 * - No options array needed.
 * - Correct answer is typically a rubric or free-form text.
 * - At least a basic answer or rubric criterion should be provided.
 *
 * @param {Object} data
 * @throws {BadRequestError}
 */
const validateLongAnswer = (data) => {
  const { correctAnswers } = data;

  if (
    !correctAnswers ||
    correctAnswers.length === 0 ||
    (correctAnswers.length === 1 &&
      typeof correctAnswers[0] === "string" &&
      !correctAnswers[0].trim())
  ) {
    throw new BadRequestError(
      "Long answer requires at least a model answer or rubric."
    );
  }
};

/**
 * Validates a FILL_IN_THE_BLANK question.
 * - Requires at least 1 acceptable answer.
 * - Each answer must be non-empty.
 *
 * @param {Object} data
 * @throws {BadRequestError}
 */
const validateFillBlank = (data) => {
  const { correctAnswers } = data;

  if (!correctAnswers || correctAnswers.length < 1) {
    throw new BadRequestError(
      "Fill-in-the-blank requires at least 1 acceptable answer."
    );
  }

  if (correctAnswers.some((a) => !a || (typeof a === "string" && !a.trim()))) {
    throw new BadRequestError(
      "Each acceptable answer must be a non-empty value."
    );
  }
};

/**
 * Validates a MATCHING question.
 * - Options array represents left-side items.
 * - CorrectAnswers represent right-side items (the pairs).
 * - Each pair must have both left and right values.
 * - No duplicate left items in options or pairs.
 *
 * @param {Object} data
 * @throws {BadRequestError}
 */
const validateMatching = (data) => {
  const { options, correctAnswers } = data;

  if (!options || options.length < 2) {
    throw new BadRequestError(
      "Matching requires at least 2 options (left-side items)."
    );
  }

  _validateNoDuplicateOptions(options);

  if (!correctAnswers || correctAnswers.length < 2) {
    throw new BadRequestError(
      "Matching requires at least 2 correct answer pairs."
    );
  }

  if (correctAnswers.length !== options.length) {
    throw new BadRequestError(
      "Number of correct answer pairs must match the number of options."
    );
  }

  const seenLeft = new Set();
  for (let i = 0; i < correctAnswers.length; i++) {
    const pair = correctAnswers[i];
    if (!pair || !pair.left || !pair.right) {
      throw new BadRequestError(
        `Matching pair at index ${i} must have both "left" and "right" values.`
      );
    }

    if (seenLeft.has(pair.left)) {
      throw new BadRequestError(
        `Duplicate left item "${pair.left}" found in matching pairs.`
      );
    }
    seenLeft.add(pair.left);
  }
};

/**
 * Validates an ORDERING question.
 * - Options array represents the items to be ordered.
 * - CorrectAnswers define the expected sequence (typically as an array of IDs).
 * - Requires at least 2 items.
 * - All options must be included in the correct order.
 * - No duplicate option IDs.
 *
 * @param {Object} data
 * @throws {BadRequestError}
 */
const validateOrdering = (data) => {
  const { options, correctAnswers } = data;

  if (!options || options.length < 2) {
    throw new BadRequestError(
      "Ordering requires at least 2 items."
    );
  }

  _validateNoDuplicateOptions(options);

  if (!correctAnswers || correctAnswers.length < 2) {
    throw new BadRequestError(
      "Ordering requires at least 2 items in the correct sequence."
    );
  }

  if (correctAnswers.length !== options.length) {
    throw new BadRequestError(
      "The correct order sequence must include all options."
    );
  }

  // Every option ID must appear in the correct answer sequence
  const optionIds = options.map((o) => o.id);
  for (const id of optionIds) {
    if (!correctAnswers.includes(id)) {
      throw new BadRequestError(
        `Option "${id}" is missing from the correct order sequence.`
      );
    }
  }

  // No duplicates in the correct sequence
  if (new Set(correctAnswers).size !== correctAnswers.length) {
    throw new BadRequestError("Duplicate items in the correct order sequence are not allowed.");
  }
};

/* -------------------------------------------------------------------------- */
/*                          Cross-Cutting Validation                          */
/* -------------------------------------------------------------------------- */

/**
 * Validates marks configuration.
 * - Marks must be a positive number (already validated by the request validator).
 * - Negative marks cannot exceed the positive marks for a question.
 *
 * @param {Object} data
 * @throws {BadRequestError}
 */
const validateMarks = (data) => {
  if (data.negativeMarks && data.marks && data.negativeMarks > data.marks) {
    throw new BadRequestError(
      "Negative marks cannot exceed the total marks for this question."
    );
  }
};

/* -------------------------------------------------------------------------- */
/*                    Normalisation Helper (updateQuestion)                    */
/* -------------------------------------------------------------------------- */

/**
 * Builds a merged payload from the existing question doc and incoming update
 * data, so that validators always see the full picture — not just the partial
 * update fields.
 *
 * Handles array fields (options, correctAnswers, tags, etc.) by replacing
 * them entirely when provided, rather than spreading old + new values.
 *
 * @param {Object} existing - The current question document (Mongoose document).
 * @param {Object} update   - The partial update payload from the client.
 * @returns {Object} A plain object safe to pass to validateQuestionConfiguration().
 */
const _buildValidationPayload = (existing, update) => {
  const base = existing.toObject ? existing.toObject() : { ...existing };

  // For array / object fields, the update value should fully replace
  // the existing value — never merge piecewise.
  const replaceFields = [
    "options",
    "correctAnswers",
    "tags",
    "images",
    "attachments",
    "externalResources",
  ];

  for (const field of replaceFields) {
    if (update[field] !== undefined) {
      base[field] = update[field];
    }
  }

  // Scalar fields — simple override
  const scalarFields = [
    "title",
    "questionText",
    "type",
    "explanation",
    "hint",
    "marks",
    "negativeMarks",
    "difficulty",
    "estimatedTime",
  ];

  for (const field of scalarFields) {
    if (update[field] !== undefined) {
      base[field] = update[field];
    }
  }

  // Deep-merge sub-documents
  if (update.codeSnippet !== undefined) {
    base.codeSnippet = { ...base.codeSnippet, ...update.codeSnippet };
  }
  if (update.settings !== undefined) {
    base.settings = { ...base.settings, ...update.settings };
  }

  return base;
};

/* -------------------------------------------------------------------------- */
/*                          Central Validation Dispatcher                     */
/* -------------------------------------------------------------------------- */

/**
 * Routes to the correct type-specific validator based on `data.type`.
 * Call this from createQuestion() and updateQuestion() instead of
 * inline switch blocks.
 *
 * @param {Object} data - The full question payload.
 * @throws {BadRequestError}
 */
const validateQuestionConfiguration = (data) => {
  const { type } = data;

  if (!type) {
    throw new BadRequestError("Question type is required for validation.");
  }

  validateMarks(data);

  switch (type) {
    case QUESTION_TYPES.MULTIPLE_CHOICE_SINGLE:
      validateMCQSingle(data);
      break;

    case QUESTION_TYPES.MULTIPLE_CHOICE_MULTIPLE:
      validateMCQMultiple(data);
      break;

    case QUESTION_TYPES.TRUE_FALSE:
      validateTrueFalse(data);
      break;

    case QUESTION_TYPES.SHORT_ANSWER:
      validateShortAnswer(data);
      break;

    case QUESTION_TYPES.LONG_ANSWER:
      validateLongAnswer(data);
      break;

    case QUESTION_TYPES.FILL_IN_THE_BLANK:
      validateFillBlank(data);
      break;

    case QUESTION_TYPES.MATCHING:
      validateMatching(data);
      break;

    case QUESTION_TYPES.ORDERING:
      validateOrdering(data);
      break;

    default:
      throw new BadRequestError(`Unsupported question type: "${type}".`);
  }
};

/* -------------------------------------------------------------------------- */
/*                          Quiz State Validation                             */
/* -------------------------------------------------------------------------- */

/**
 * Ensures the target quiz is not soft-deleted or archived.
 *
 * @param {Object} quiz - Mongoose quiz document.
 * @throws {BadRequestError}
 */
const _validateQuizActive = (quiz) => {
  if (quiz.deletedAt) {
    throw new BadRequestError("Cannot modify a deleted quiz.");
  }
  if (quiz.archivedAt) {
    throw new BadRequestError("Cannot modify an archived quiz.");
  }
};

/* -------------------------------------------------------------------------- */
/*                          Quiz Statistics Helpers                           */
/* -------------------------------------------------------------------------- */

/**
 * Recalculates totalQuestions and totalMarks for a quiz from its active
 * questions and writes them directly.
 *
 * Intentionally avoids $inc so it is self-healing if a previous operation
 * drifted out of sync.
 *
 * @param {string}   quizId
 * @param {Object}   [options]
 * @param {Object}   [options.session] - MongoDB session for transactions.
 * @returns {Promise<void>}
 */
const _updateQuizStatistics = async (quizId, options = {}) => {
  const stats = await Question.aggregate([
    { $match: { quiz: new mongoose.Types.ObjectId(quizId), ...ACTIVE_FILTER } },
    {
      $group: {
        _id: null,
        totalQuestions: { $sum: 1 },
        totalMarks: { $sum: "$marks" },
      },
    },
  ]).session(options.session || null);

  const { totalQuestions = 0, totalMarks = 0 } = stats[0] || {};

  const updateOp = Quiz.updateOne(
    { _id: quizId },
    { $set: { "statistics.totalQuestions": totalQuestions, "statistics.totalMarks": totalMarks } }
  );

  if (options.session) {
    updateOp.session(options.session);
  }

  await updateOp;
};

/* -------------------------------------------------------------------------- */
/*                          Ordering Helpers                                  */
/* -------------------------------------------------------------------------- */

/**
 * Determines the next available order value within a quiz.
 *
 * @param {string} quizId
 * @param {Object} [options]
 * @param {Object} [options.session]
 * @returns {Promise<number>}
 */
const _getNextOrder = async (quizId, options = {}) => {
  let query = Question.findOne({
    quiz: quizId,
    ...ACTIVE_FILTER,
  })
    .sort({ order: -1 })
    .select("order")
    .lean();

  if (options.session) query = query.session(options.session);

  const lastQuestion = await query;

  return lastQuestion ? lastQuestion.order + 1 : 1;
};

/**
 * Reindexes question orders within a quiz so they are contiguous (1, 2, 3, …).
 *
 * @param {string} quizId
 * @param {Object} [options]
 * @param {Object} [options.session]
 * @returns {Promise<void>}
 */
const _reindexOrders = async (quizId, options = {}) => {
  let query = Question.find({
    quiz: quizId,
    ...ACTIVE_FILTER,
  })
    .sort({ order: 1 })
    .select("_id order");

  if (options.session) query = query.session(options.session);

  const questions = await query;

  if (!questions.length) return;

  const bulkOpts = options.session ? { session: options.session } : {};

  await Question.bulkWrite(
    questions.map((q, i) => ({
      updateOne: {
        filter: { _id: q._id },
        update: { $set: { order: i + 1 } },
      },
    })),
    bulkOpts
  );
};

/**
 * Shifts existing question orders down to make room at the given position.
 *
 * @param {string} quizId
 * @param {number} insertAt
 * @param {Object} [options]
 * @param {Object} [options.session]
 * @returns {Promise<void>}
 */
const _shiftOrdersDown = async (quizId, insertAt, options = {}) => {
  let query = Question.updateMany(
    {
      quiz: quizId,
      ...ACTIVE_FILTER,
      order: { $gte: insertAt },
    },
    { $inc: { order: 1 } }
  );

  if (options.session) query = query.session(options.session);

  await query;
};

/* -------------------------------------------------------------------------- */
/*                          Ownership & Quiz Helper                           */
/* -------------------------------------------------------------------------- */

/**
 * Fetches a question with its quiz and module populated, verifies existence,
 * active state, and ownership in a single flow.
 *
 * Uses populate to reduce N+1 queries.
 *
 * @param {Object}  params
 * @param {string}  params.questionId
 * @param {Object}  params.user
 * @param {boolean} [params.lean=false]
 * @returns {Promise<{question: Object, quiz: Object}>}
 */
const _getOwnedQuestion = async ({ questionId, user, lean = false }) => {
  let query = Question.findOne({ _id: questionId, ...ACTIVE_FILTER })
    .populate({
      path: "quiz",
      select: "module course deletedAt archivedAt",
    });

  if (lean) query = query.lean();

  const question = await query;

  if (!question) {
    throw new NotFoundError("Question not found.");
  }

  // When lean, quiz is a populated object; otherwise it's a Mongoose sub-doc
  const quiz = question.quiz;
  if (!quiz) {
    throw new NotFoundError("Associated quiz not found.");
  }

  _validateQuizActive(quiz);

  const module = await Module.findById(quiz.module).lean();
  if (!module) {
    throw new NotFoundError("Associated module not found.");
  }

  await verifyCourseOwnership(module.course, user);

  return { question, quiz };
};

/* -------------------------------------------------------------------------- */
/*                   Data Sanitisation Helpers                                 */
/* -------------------------------------------------------------------------- */

/**
 * Trims option text and normalises tag casing.
 *
 * @param {Object} data
 * @returns {Object}
 */
const _sanitiseQuestionData = (data) => ({
  ...data,
  options: data.options?.map((opt) => ({
    ...opt,
    text: opt.text?.trim(),
    id: opt.id?.trim(),
  })),
  tags: [...new Set((data.tags ?? []).map((t) => t.trim().toLowerCase()))],
});

/* -------------------------------------------------------------------------- */
/*                              CRUD Operations                               */
/* -------------------------------------------------------------------------- */

/**
 * Create a new question within a quiz.
 *
 * @param {Object} params
 * @param {string} params.quizId
 * @param {Object} params.user
 * @param {Object} params.data
 * @returns {Promise<Question>}
 */
const createQuestion = async ({ quizId, user, data }) => {
  logger.info("Creating question", { quizId, userId: user._id });

  // Verify quiz exists, is active, and user owns the course
  const quiz = await Quiz.findById(quizId).select("module deletedAt archivedAt");
  if (!quiz) throw new NotFoundError("Quiz not found.");

  _validateQuizActive(quiz);

  const module = await Module.findById(quiz.module).lean();
  if (!module) throw new NotFoundError("Associated module not found.");

  await verifyCourseOwnership(module.course, user);

  // Sanitise
  const sanitised = _sanitiseQuestionData(data);

  // Business validation
  validateQuestionConfiguration(sanitised);

  // ── Transactional write ──────────────────────────────────
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const order = sanitised.order ?? (await _getNextOrder(quizId, { session }));

    if (sanitised.order) {
      await _shiftOrdersDown(quizId, sanitised.order, { session });
    }

    const [question] = await Question.create(
      [
        {
          quiz: quizId,
          title: sanitised.title,
          questionText: sanitised.questionText,
          type: sanitised.type,
          order,
          options: sanitised.options ?? [],
          correctAnswers: sanitised.correctAnswers ?? [],
          explanation: sanitised.explanation ?? "",
          hint: sanitised.hint ?? "",
          marks: sanitised.marks,
          negativeMarks: sanitised.negativeMarks ?? 0,
          difficulty: sanitised.difficulty ?? DIFFICULTY_LEVELS.MEDIUM,
          estimatedTime: sanitised.estimatedTime ?? 60,
          tags: sanitised.tags ?? [],
          images: sanitised.images ?? [],
          attachments: sanitised.attachments ?? [],
          externalResources: sanitised.externalResources ?? [],
          codeSnippet: sanitised.codeSnippet,
          settings: sanitised.settings,
          createdBy: user._id,
        },
      ],
      { session }
    );

    await _updateQuizStatistics(quizId, { session });

    await session.commitTransaction();

    logger.info("Question created", {
      questionId: question._id,
      quizId,
      userId: user._id,
      type: sanitised.type,
    });

    return question;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Update an existing question.
 *
 * @param {Object} params
 * @param {string} params.questionId
 * @param {Object} params.user
 * @param {Object} params.data
 * @returns {Promise<Question>}
 */
const updateQuestion = async ({ questionId, user, data }) => {
  logger.info("Updating question", { questionId, userId: user._id });

  const { question, quiz } = await _getOwnedQuestion({ questionId, user });
  _validateQuizActive(quiz);

  // Sanitise
  const sanitised = _sanitiseQuestionData(data);

  // Build a complete validation payload so validators see the full picture
  const validationPayload = _buildValidationPayload(question, sanitised);

  // Business validation
  validateQuestionConfiguration(validationPayload);

  // ── Transactional write ──────────────────────────────────
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Whitelist of editable fields
    const allowedFields = [
      "title",
      "questionText",
      "type",
      "options",
      "correctAnswers",
      "explanation",
      "hint",
      "marks",
      "negativeMarks",
      "difficulty",
      "estimatedTime",
      "tags",
      "images",
      "attachments",
      "externalResources",
      "codeSnippet",
      "settings",
    ];

    allowedFields.forEach((field) => {
      if (sanitised[field] !== undefined) {
        question[field] = sanitised[field];
      }
    });

    question.updatedBy = user._id;
    await question.save({ session });

    await _updateQuizStatistics(quiz._id, { session });

    await session.commitTransaction();

    logger.info("Question updated", {
      questionId,
      quizId: quiz._id,
      userId: user._id,
    });

    return question;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Retrieve a single question by ID.
 *
 * @param {Object} params
 * @param {string} params.questionId
 * @param {Object} params.user
 * @returns {Promise<Object>}
 */
const getQuestion = async ({ questionId, user }) => {
  logger.info("Fetching question", { questionId, userId: user._id });

  const { question } = await _getOwnedQuestion({ questionId, user, lean: true });

  return question;
};

/**
 * Retrieve paginated questions for a quiz.
 *
 * @param {Object} params
 * @param {string} params.quizId
 * @param {Object} params.user
 * @param {Object} params.query
 * @returns {Promise<{questions: Array, pagination: Object}>}
 */
const getQuizQuestions = async ({ quizId, user, query }) => {
  logger.info("Fetching questions for quiz", { quizId, userId: user._id });

  // Verify quiz + ownership
  const quiz = await Quiz.findById(quizId).select("module deletedAt archivedAt");
  if (!quiz) throw new NotFoundError("Quiz not found.");

  const module = await Module.findById(quiz.module).lean();
  if (!module) throw new NotFoundError("Associated module not found.");

  await verifyCourseOwnership(module.course, user);

  // Reuse the shared pagination utility
  const { page, limit, skip } = getPagination(query);

  // Build filter
  const filter = { quiz: quizId, ...ACTIVE_FILTER };

  if (query.difficulty) {
    filter.difficulty = query.difficulty;
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.search) {
    filter.$or = [
      { title: { $regex: query.search, $options: "i" } },
      { questionText: { $regex: query.search, $options: "i" } },
    ];
  }

  // Parse sort
  const SORTABLE_FIELDS = ["order", "createdAt", "updatedAt", "difficulty", "type"];
  let sort = { order: 1 };

  if (query.sort) {
    const desc = query.sort.startsWith("-");
    const field = desc ? query.sort.slice(1) : query.sort;
    if (SORTABLE_FIELDS.includes(field)) {
      sort = { [field]: desc ? -1 : 1 };
    }
  }

  const [questions, total] = await Promise.all([
    Question.find(filter)
      .select("title questionText type difficulty marks order createdAt updatedAt")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Question.countDocuments(filter),
  ]);

  return {
    questions,
    pagination: getPaginationMeta(total, page, limit),
  };
};

/**
 * Soft delete a question and reindex remaining orders.
 *
 * @param {Object} params
 * @param {string} params.questionId
 * @param {Object} params.user
 * @returns {Promise<void>}
 */
const deleteQuestion = async ({ questionId, user }) => {
  logger.info("Deleting question", { questionId, userId: user._id });

  const { question, quiz } = await _getOwnedQuestion({ questionId, user });
  _validateQuizActive(quiz);

  // ── Transactional write ──────────────────────────────────
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    question.deletedAt = new Date();
    question.updatedBy = user._id;
    await question.save({ session });

    await _reindexOrders(question.quiz, { session });
    await _updateQuizStatistics(question.quiz, { session });

    await session.commitTransaction();

    logger.info("Question deleted", {
      questionId,
      quizId: quiz._id,
      userId: user._id,
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Reorder questions within a quiz.
 *
 * Validates that:
 * - All question IDs exist and belong to the specified quiz.
 * - No duplicate IDs or orders.
 * - Orders are sequential (1, 2, 3, …, N).
 * - The payload includes EVERY active question in the quiz — i.e. it must
 *   describe the full desired ordering, not a partial subset. (A partial
 *   payload would collide with the unlisted questions' existing orders and
 *   violate the unique { quiz, order } index.)
 *
 * @param {Object} params
 * @param {string} params.quizId
 * @param {Object} params.user
 * @param {Array}  params.questions
 * @returns {Promise<Array>}
 */
const reorderQuestions = async ({ quizId, user, questions }) => {
  logger.info("Reordering questions", { quizId, userId: user._id, count: questions.length });

  // Verify quiz + ownership
  const quiz = await Quiz.findById(quizId).select("module deletedAt archivedAt");
  if (!quiz) throw new NotFoundError("Quiz not found.");

  _validateQuizActive(quiz);

  const module = await Module.findById(quiz.module).lean();
  if (!module) throw new NotFoundError("Associated module not found.");

  await verifyCourseOwnership(module.course, user);

  // ── Validation ──────────────────────────────────────────

  const ids = questions.map((q) => q.questionId);
  const orders = questions.map((q) => q.order);

  // No duplicate question IDs
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestError("Duplicate question IDs are not allowed.");
  }

  // No duplicate orders
  if (new Set(orders).size !== orders.length) {
    throw new BadRequestError("Duplicate question orders are not allowed.");
  }

  // All orders must be positive integers
  if (orders.some((o) => !Number.isInteger(o) || o < 1)) {
    throw new BadRequestError("All orders must be positive integers.");
  }

  // Orders must be sequential 1…N
  const sorted = [...orders].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      throw new BadRequestError("Question orders must be sequential (1, 2, 3, …).");
    }
  }

  // Verify all questions exist and belong to this quiz
  const existing = await Question.find({
    _id: { $in: ids },
    quiz: quizId,
    ...ACTIVE_FILTER,
  })
    .select("_id")
    .lean();

  if (existing.length !== ids.length) {
    const existingIds = existing.map((q) => q._id.toString());
    const missing = ids.filter((id) => !existingIds.includes(id));
    throw new BadRequestError(
      `Questions not found or do not belong to this quiz: ${missing.join(", ")}`
    );
  }

  // The payload must describe the FULL ordering of the quiz.
  //
  // Because orders must be sequential 1…N, a partial payload (fewer items
  // than active questions) would leave questions outside the payload at their
  // old orders. Phase 2 below would then try to write a target order that a
  // non-payload question already holds → E11000 duplicate key on
  // { quiz, order }. Requiring full coverage makes the two-phase swap safe.
  const activeCount = await Question.countDocuments({
    quiz: quizId,
    ...ACTIVE_FILTER,
  });

  if (questions.length !== activeCount) {
    throw new BadRequestError(
      `Reorder must include all ${activeCount} active questions in the quiz (received ${questions.length}).`
    );
  }

  // ── Transactional reorder via bulkWrite ──────────────────

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Phase 1: Set all orders to negative values to free up constraints
    const phase1Ops = questions.map((q) => ({
      updateOne: {
        filter: { _id: q.questionId },
        update: { $set: { order: -(q.order) } },
      },
    }));

    await Question.bulkWrite(phase1Ops, { session });

    // Phase 2: Set to the final positive values
    const phase2Ops = questions.map((q) => ({
      updateOne: {
        filter: { _id: q.questionId },
        update: { $set: { order: q.order } },
      },
    }));

    await Question.bulkWrite(phase2Ops, { session });

    await session.commitTransaction();

    logger.info("Questions reordered", { quizId, userId: user._id, count: questions.length });

    return questions;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/* -------------------------------------------------------------------------- */
/*                                 Exports                                    */
/* -------------------------------------------------------------------------- */

export {
  createQuestion,
  updateQuestion,
  getQuestion,
  getQuizQuestions,
  deleteQuestion,
  reorderQuestions,
  // Validation helpers (exposed for testing / reuse)
  validateQuestionConfiguration,
  validateMCQSingle,
  validateMCQMultiple,
  validateTrueFalse,
  validateShortAnswer,
  validateLongAnswer,
  validateFillBlank,
  validateMatching,
  validateOrdering,
  validateMarks,
};
