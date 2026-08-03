import mongoose from "mongoose";
import slugify from "slugify";

import Quiz from "../models/quiz.model.js";
import Question from "../models/question.model.js";
import Module from "../models/module.model.js";

import { verifyCourseOwnership } from "../helpers/ownership.helper.js";
import { NotFoundError, BadRequestError, ForbiddenError } from "../errors/index.js";
import logger from "../config/logger.js";

/**
 * Reusable query filters.
 */
const ACTIVE_QUIZ_FILTER = { deletedAt: null };

/**
 * Generates a unique slug scoped to the instructor.
 * Ensures the slug + instructor combination is unique per the compound index.
 *
 * @param {string} title
 * @param {string} instructorId
 * @returns {Promise<string>}
 */
const _generateUniqueSlug = async (title, instructorId) => {
  const baseSlug = slugify(title, { lower: true, strict: true, trim: true });

  let slug = baseSlug;
  let counter = 1;

  while (
    await Quiz.exists({
      instructor: instructorId,
      slug,
      ...ACTIVE_QUIZ_FILTER,
    })
  ) {
    slug = `${baseSlug}-${counter++}`;
  }

  return slug;
};

/**
 * Determines the next available order within a module.
 *
 * @param {string} moduleId
 * @returns {Promise<number>}
 */
const _getNextQuizOrder = async (moduleId) => {
  const lastQuiz = await Quiz.findOne({
    module: moduleId,
    ...ACTIVE_QUIZ_FILTER,
  })
    .sort({ order: -1 })
    .select("order")
    .lean();

  return lastQuiz ? lastQuiz.order + 1 : 1;
};

/**
 * Fetches a quiz, verifies it exists and is not deleted,
 * then checks ownership through the module → course chain.
 *
 * @param {Object}      params
 * @param {string}      params.quizId
 * @param {Object}      params.user
 * @param {boolean}     [params.lean=false]
 * @param {Array}       [params.populatePaths]
 * @returns {Promise<Object>}
 */
const _getOwnedQuiz = async ({ quizId, user, lean = false, populatePaths }) => {
  let query = Quiz.findOne({ _id: quizId, ...ACTIVE_QUIZ_FILTER });

  if (populatePaths) {
    for (const path of populatePaths) {
      query = query.populate(path);
    }
  }

  const quiz = lean ? await query.lean() : await query;

  if (!quiz) {
    throw new NotFoundError("Quiz not found");
  }

  // Resolve course ownership via the parent module
  const module = await Module.findById(quiz.module);
  if (!module) {
    throw new NotFoundError("Associated module not found");
  }

  await verifyCourseOwnership(module.course, user);

  return quiz;
};

/**
 * Centralized pagination helper.
 *
 * @param {Object} [query={}]
 * @param {number} [query.page]
 * @param {number} [query.limit]
 * @returns {{ page: number, limit: number, skip: number }}
 */
export const getPagination = (query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/** Allowed sort fields for quiz listing. */
const SORT_FIELDS = ["order", "createdAt", "updatedAt", "title", "status"];

/**
 * Parses sort parameter into a MongoDB sort object.
 * Accepts "field" (asc) or "-field" (desc).
 *
 * @param {string} [sortBy="order"]
 * @returns {Object}
 */
export const parseSort = (sortBy = "order") => {
  const desc = sortBy.startsWith("-");
  const field = desc ? sortBy.slice(1) : sortBy;

  if (!SORT_FIELDS.includes(field)) {
    return { order: 1 };
  }

  return { [field]: desc ? -1 : 1 };
};


/**
 * Create a new quiz.
 *
 * @async
 * @param {Object} params
 * @param {string} params.moduleId
 * @param {Object} params.user
 * @param {Object} params.data
 * @returns {Promise<Quiz>}
 * @throws {NotFoundError|ForbiddenError}
 */
const createQuiz = async ({ moduleId, user, data }) => {
  logger.info(`Creating quiz for module: ${moduleId}`);

  // Verify the module exists and the user owns the parent course
  const module = await Module.findById(moduleId);
  if (!module) {
    throw new NotFoundError("Module not found");
  }
  const course = await verifyCourseOwnership(module.course, user);

  // Generate slug (scoped to the course instructor)
  const instructorId = course.instructor;
  const slug = await _generateUniqueSlug(data.title, instructorId);

  // Determine quiz order
  const order = data.order ?? (await _getNextQuizOrder(moduleId));

  // Create quiz
  const quiz = await Quiz.create({
    course: module.course,
    module: module._id,
    instructor: instructorId,

    title: data.title,
    slug,
    description: data.description,
    instructions: data.instructions,

    settings: data.settings,
    availability: data.availability,

    order,

    createdBy: user.id,
  });

  logger.info(`Quiz created successfully: ${quiz._id}`);

  return quiz;
};

/**
 * Update an existing quiz.
 *
 * @async
 * @param {Object} params
 * @param {string} params.quizId
 * @param {Object} params.user
 * @param {Object} params.data
 * @returns {Promise<Quiz>}
 * @throws {NotFoundError|ForbiddenError}
 */
const updateQuiz = async ({ quizId, user, data }) => {
  logger.info(`Updating quiz: ${quizId}`);

  const quiz = await _getOwnedQuiz({ quizId, user });

  // Regenerate slug if title changes
  if (data.title && data.title !== quiz.title) {
    quiz.slug = await _generateUniqueSlug(data.title, quiz.instructor);
    quiz.title = data.title;
  }

  // Update editable fields
  if (data.description !== undefined) quiz.description = data.description;
  if (data.instructions !== undefined) quiz.instructions = data.instructions;
  if (data.order !== undefined) quiz.order = data.order;

  // Deep-merge sub-documents
  if (data.settings !== undefined) {
    quiz.settings = { ...quiz.settings.toObject(), ...data.settings };
  }
  if (data.availability !== undefined) {
    quiz.availability = { ...quiz.availability.toObject(), ...data.availability };
  }

  quiz.updatedBy = user.id;
  await quiz.save();

  logger.info(`Quiz updated successfully: ${quiz._id}`);
  return quiz;
};

/**
 * Retrieve a quiz by ID.
 *
 * @async
 * @param {Object} params
 * @param {string} params.quizId
 * @param {Object} params.user
 * @returns {Promise<Object>}
 * @throws {NotFoundError|ForbiddenError}
 */
const getQuiz = async ({ quizId, user }) => {
  logger.info(`Fetching quiz: ${quizId}`);

  return _getOwnedQuiz({
    quizId,
    user,
    lean: true,
    populatePaths: [
      { path: "course", select: "title" },
      { path: "module", select: "title" },
    ],
  });
};

/**
 * Retrieve quizzes for a module.
 *
 * @async
 * @param {Object}   params
 * @param {string}   params.moduleId
 * @param {Object}   params.user
 * @param {Object}   params.query
 * @returns {Promise<{quizzes: Array, pagination: Object}>}
 */
const getModuleQuizzes = async ({ moduleId, user, query }) => {
  logger.info(`Fetching quizzes for module: ${moduleId}`);

  // Verify module + ownership
  const module = await Module.findById(moduleId);
  if (!module) throw new NotFoundError("Module not found");
  await verifyCourseOwnership(module.course, user);

  const { page, limit, skip } = getPagination(query);
  const sort = parseSort(query.sortBy);

  const filter = { module: moduleId, ...ACTIVE_QUIZ_FILTER };
  if (query.status) filter.status = query.status;

  const [quizzes, total] = await Promise.all([
    Quiz.find(filter)
      .select("title slug order status statistics createdAt")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Quiz.countDocuments(filter),
  ]);

  return {
    quizzes,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

/**
 * Publish a quiz.
 *
 * @async
 * @param {Object} params
 * @param {string} params.quizId
 * @param {Object} params.user
 * @returns {Promise<Quiz>}
 * @throws {NotFoundError|ForbiddenError|BadRequestError}
 */
const publishQuiz = async ({ quizId, user }) => {
  logger.info(`Publishing quiz: ${quizId}`);

  const quiz = await _getOwnedQuiz({ quizId, user });
  await _validatePublishRules(quiz);

  quiz.status = "PUBLISHED";
  quiz.publishedAt = new Date();
  quiz.updatedBy = user.id;

  await quiz.save();

  logger.info(`Quiz published successfully: ${quiz._id}`);
  return quiz;
};

/**
 * Validate whether a quiz can be published.
 *
 * @private
 * @param {Quiz} quiz
 * @throws {BadRequestError}
 */
const _validatePublishRules = async (quiz) => {
  const questionCount = await Question.countDocuments({
    quiz: quiz._id,
    deletedAt: null,
  });

  if (questionCount === 0) {
    throw new BadRequestError("Quiz must contain at least one question before publishing.");
  }
  if (quiz.settings.passingPercentage < 0 || quiz.settings.passingPercentage > 100) {
    throw new BadRequestError("Passing percentage must be between 0 and 100.");
  }
};

/**
 * Archive a quiz.
 *
 * @async
 * @param {Object} params
 * @param {string} params.quizId
 * @param {Object} params.user
 * @returns {Promise<Quiz>}
 */
const archiveQuiz = async ({ quizId, user }) => {
  logger.info(`Archiving quiz: ${quizId}`);

  const quiz = await _getOwnedQuiz({ quizId, user });

  quiz.status = "ARCHIVED";
  quiz.archivedAt = new Date();
  quiz.updatedBy = user.id;

  await quiz.save();

  logger.info(`Quiz archived successfully: ${quiz._id}`);
  return quiz;
};

/**
 * Soft delete a quiz and reindex remaining orders.
 *
 * @async
 * @param {Object} params
 * @param {string} params.quizId
 * @param {Object} params.user
 * @returns {Promise<void>}
 */
const deleteQuiz = async ({ quizId, user }) => {
  logger.info(`Deleting quiz: ${quizId}`);

  const quiz = await _getOwnedQuiz({ quizId, user });

  quiz.deletedAt = new Date();
  quiz.updatedBy = user.id;
  await quiz.save();

  await _reindexQuizOrders(quiz.module);

  logger.info(`Quiz deleted successfully: ${quiz._id}`);
};

/**
 * Reindex quiz orders within a module so they are contiguous.
 *
 * @private
 * @param {string} moduleId
 * @returns {Promise<void>}
 */
const _reindexQuizOrders = async (moduleId) => {
  const quizzes = await Quiz.find({ module: moduleId, deletedAt: null })
    .sort({ order: 1 })
    .select("_id order");

  if (!quizzes.length) return;

  await Quiz.bulkWrite(
    quizzes.map((q, i) => ({
      updateOne: { filter: { _id: q._id }, update: { $set: { order: i + 1 } } },
    }))
  );
};

/**
 * Reorder quizzes within a module using a two-phase strategy
 * to avoid transient unique-index conflicts.
 *
 * @async
 * @param {Object} params
 * @param {string} params.moduleId
 * @param {Object} params.user
 * @param {Array}  params.quizzes
 * @returns {Promise<Array>}
 */
const reorderQuizzes = async ({ moduleId, user, quizzes }) => {
  logger.info(`Reordering quizzes for module: ${moduleId}`);

  // Verify module + ownership
  const module = await Module.findById(moduleId);
  if (!module) throw new NotFoundError("Module not found");
  await verifyCourseOwnership(module.course, user);

  // ── Validation ──────────────────────────────────────────

  const ids = quizzes.map((q) => q.quizId);
  const orders = quizzes.map((q) => q.order);

  // No duplicate quiz IDs
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestError("Duplicate quiz IDs are not allowed.");
  }

  // No duplicate orders
  if (new Set(orders).size !== orders.length) {
    throw new BadRequestError("Duplicate quiz orders are not allowed.");
  }

  // All orders must be positive integers
  if (orders.some((o) => !Number.isInteger(o) || o < 1)) {
    throw new BadRequestError("All orders must be positive integers.");
  }

  // Orders must be sequential 1…N
  const sorted = [...orders].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      throw new BadRequestError("Quiz orders must be sequential (1, 2, 3, …).");
    }
  }

  // All active quizzes in the module must be included
  const totalQuizzes = await Quiz.countDocuments({
    module: moduleId,
    ...ACTIVE_QUIZ_FILTER,
  });
  if (quizzes.length !== totalQuizzes) {
    throw new BadRequestError("All quizzes in the module must be included in the reorder request.");
  }

  // ── Transaction ─────────────────────────────────────────

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // Phase 1 — Shift to unique negative temp orders
    await Quiz.bulkWrite(
      quizzes.map((q, i) => ({
        updateOne: {
          filter: { _id: q.quizId, module: moduleId, ...ACTIVE_QUIZ_FILTER },
          update: { $set: { order: -(i + 1) } },
        },
      })),
      { session }
    );

    // Phase 2 — Assign final positive orders
    await Quiz.bulkWrite(
      quizzes.map((q) => ({
        updateOne: {
          filter: { _id: q.quizId, module: moduleId, ...ACTIVE_QUIZ_FILTER },
          update: { $set: { order: q.order } },
        },
      })),
      { session }
    );

    await session.commitTransaction();

    logger.info(`Quiz reordering completed.`);

    // Return a lightweight response
    return Quiz.find({ module: moduleId, ...ACTIVE_QUIZ_FILTER })
      .select("title order")
      .sort({ order: 1 })
      .lean();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export {
  createQuiz,
  updateQuiz,
  getQuiz,
  getModuleQuizzes,
  publishQuiz,
  archiveQuiz,
  deleteQuiz,
  reorderQuizzes,
};