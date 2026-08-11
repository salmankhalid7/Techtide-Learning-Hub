import mongoose from "mongoose";
/**
 * @file lesson.service.js
 * @description Business logic for Lesson operations.
 *
 * Architecture
 * ─────────────
 *   Route → Validator → Controller → Lesson Service → Lesson Model → MongoDB
 *
 * Responsibilities
 * ────────────────
 *   • Business rule validation
 *   • Database interaction
 *   • Ownership verification
 *   • Slug generation
 *   • Ordering logic (with auto-shift on duplicates)
 *   • Publishing / Archive rules
 *   • Soft delete
 *
 * This layer never knows about Express (req, res, next).
 * It throws ApiError subclasses — the global error middleware
 * handles the HTTP response.
 */

import Lesson from "../models/lesson.model.js";
import Module from "../models/module.model.js";
import generateUniqueSlug from "../utils/generateUniqueSlug.js";
import { verifyCourseOwnership } from "../helpers/ownership.helper.js";
import { refreshCourseStats } from "../helpers/courseStats.helper.js";
import { LESSON_STATUS_ENUM } from "../constants/lesson.constants.js";
import { NotFoundError, BadRequestError } from "../errors/index.js";

// ── Helpers ────────────────────────────────────────────────

/**
 * Determines the next order value for a new lesson within a module.
 * If no lessons exist, starts at 1.
 */
const getNextOrder = async (moduleId, session = null) => {
    // Use Mongoose findOne so the pre-find middleware (isDeleted: false)
    // is applied — only count active lessons for auto-assigning order.
    const query = Lesson.findOne({ module: moduleId })
        .sort({ order: -1 })
        .select("order");

    if (session) query.session(session);

    const lastLesson = await query;

    return lastLesson ? lastLesson.order + 1 : 1;
};

/**
 * Shifts the order of existing lessons down by one to make room
 * for a new lesson at the given `insertAt` position.
 *
 * Uses a single bulkWrite for atomicity.
 */
const shiftOrdersDown = async (moduleId, insertAt, session = null) => {
    const bulkOptions = session ? { session } : {};

    await Lesson.bulkWrite(
        [
            {
                updateMany: {
                    filter: {
                        module: moduleId,
                        isDeleted: false,
                        order: { $gte: insertAt },
                    },
                    update: { $inc: { order: 1 } },
                },
            },
        ],
        bulkOptions
    );
};

/**
 * Validates that a lesson has the required content for its lessonType
 * before it can be published.
 *
 * Content schema per model:
 *   content: {
 *     type: "VIDEO" | "TEXT" | ...,
 *     video?: { ... },
 *     text?: { ... },
 *     ...
 *   }
 *
 * LIVE_SESSION only requires the type discriminator.
 */
const validateLessonContent = (lesson) => {
    const content = lesson.content ?? {};

    if (lesson.lessonType === "LIVE_SESSION") {
        if (content.type !== "LIVE_SESSION") {
            throw new BadRequestError(
                "Live session configuration is required before publishing"
            );
        }
        return;
    }

    // For VIDEO, TEXT, PDF, AUDIO, EXTERNAL_LINK:
    // require that the matching sub-schema has data.
    const contentKey = lesson.lessonType.toLowerCase();
    const hasContent =
        content.type === lesson.lessonType && content[contentKey];

    if (!hasContent) {
        throw new BadRequestError(
            `Lesson content is required before publishing a ${lesson.lessonType} lesson`
        );
    }
};

/**
 * Whitelist of fields allowed for lesson updates.
 */
const ALLOWED_UPDATE_FIELDS = [
    "title",
    "description",
    "lessonType",
    "content",
    "resources",
    "duration",
    "isPreview",
    "isLocked",
    "releaseAt",
];

// ── Create Lesson ──────────────────────────────────────────

/**
 * Creates a new lesson inside a module.
 *
 * Auto-assigns order (default: next available). If a specific order
 * is provided, existing lessons at or after that position are shifted
 * down to avoid duplicates.
 *
 * @param   {object}  payload             - Lesson data from the request body.
 * @param   {string}  payload.module      - Module ObjectId.
 * @param   {string}  payload.title       - Lesson title.
 * @param   {string}  [payload.description]
 * @param   {string}  payload.lessonType  - One of LESSON_TYPES.
 * @param   {object}  [payload.content]
 * @param   {Array}   [payload.resources]
 * @param   {number}  [payload.order]
 * @param   {number}  [payload.duration]
 * @param   {boolean} [payload.isPreview]
 * @param   {boolean} [payload.isLocked]
 * @param   {string}  [payload.releaseAt]
 * @param   {object}  user                - Authenticated user (`req.user`).
 * @param   {object}  [session]           - Optional MongoDB session for transactions.
 * @returns {Promise<object>}             The created Lesson document.
 */
export const createLesson = async (payload, user, session = null) => {
    const { module: moduleId, title, order } = payload;

    // 1. Verify the Module exists
    const module = await Module.findById(moduleId).session(session);
    if (!module) {
        throw new NotFoundError("Module not found");
    }

    // 2. Verify the current user owns the parent Course (or is an Admin)
    await verifyCourseOwnership(module.course, user);

    // 3. Generate a unique slug
    const slug = await generateUniqueSlug(title, Lesson);

    // 4. Determine lesson order
    const lessonOrder = order ?? (await getNextOrder(moduleId, session));

    // 5. If a specific order was given, shift existing lessons down
    if (order !== undefined && order !== null) {
        await shiftOrdersDown(moduleId, order, session);
    }

    // 6. Create the lesson
    const lessonData = {
        ...payload,
        slug,
        order: lessonOrder,
    };

    const [lesson] = session
        ? await Lesson.create([lessonData], { session })
        : await Lesson.create([lessonData]);

    // A new lesson changes the course's lesson/duration totals — refresh.
    await refreshCourseStats(module.course);

    return lesson;
};

// ── Update Lesson ──────────────────────────────────────────

/**
 * Updates lesson fields. Regenerates the slug if the title changes.
 *
 * @param   {string}  lessonId
 * @param   {object}  updateData
 * @param   {object}  user
 * @param   {object}  [session]
 * @returns {Promise<object>} Updated Lesson document.
 */
export const updateLesson = async (lessonId, updateData, user, session = null) => {
    const lesson = await Lesson.findById(lessonId).session(session);

    if (!lesson || lesson.isDeleted) {
        throw new NotFoundError("Lesson not found");
    }

    // Verify ownership through Module → Course chain
    const module = await Module.findById(lesson.module).session(session);
    if (!module) {
        throw new NotFoundError("Associated module not found");
    }

    await verifyCourseOwnership(module.course, user);

    // Regenerate slug if title changes
    if (updateData.title && updateData.title !== lesson.title) {
        lesson.slug = await generateUniqueSlug(
            updateData.title,
            Lesson,
            lessonId
        );
    }

    // Apply allowed fields
    for (const field of ALLOWED_UPDATE_FIELDS) {
        if (updateData[field] !== undefined) {
            lesson[field] = updateData[field];
        }
    }

    // Increment custom version field (versionKey is false in the model)
    lesson.version += 1;

    session ? await lesson.save({ session }) : await lesson.save();

    // If the lesson duration changed, refresh course lesson/duration totals.
    if (updateData.duration !== undefined) {
        await refreshCourseStats(module.course);
    }

    return lesson;
};

// ── Get Lesson By ID ───────────────────────────────────────

/**
 * Retrieves a single lesson with its parent Module populated.
 *
 * @param   {string}  lessonId
 * @param   {object}  [session]
 * @returns {Promise<object>}
 */
export const getLessonById = async (lessonId, session = null) => {
    const query = Lesson.findById(lessonId).populate("module");
    if (session) query.session(session);

    const lesson = await query;

    if (!lesson) {
        throw new NotFoundError("Lesson not found");
    }

    return lesson;
};

// ── Get Lessons By Module ──────────────────────────────────

/**
 * Returns all lessons for a given module, ordered by the `order` field.
 *
 * @param   {string}  moduleId
 * @param   {object}  [session]
 * @returns {Promise<Array>}
 */
export const getLessonsByModule = async (moduleId, session = null) => {
    // Verify the module exists
    const module = await Module.findById(moduleId).session(session);
    if (!module) {
        throw new NotFoundError("Module not found");
    }

    const lessons = await Lesson.find({ module: moduleId })
        .session(session)
        .sort({ order: 1 })
        .lean();

    return lessons;
};

// ── Publish Lesson ─────────────────────────────────────────

/**
 * Publishes a lesson.
 *
 * Business rules:
 *   • Lesson must not be deleted.
 *   • Parent Module must not be archived.
 *   • Required content must exist (based on lessonType).
 *   • Status becomes PUBLISHED.
 *
 * @param   {string}  lessonId
 * @param   {object}  user
 * @param   {object}  [session]
 * @returns {Promise<object>}
 */
export const publishLesson = async (lessonId, user, session = null) => {
    const lesson = await Lesson.findById(lessonId).session(session);

    if (!lesson || lesson.isDeleted) {
        throw new NotFoundError("Lesson not found");
    }

    // Verify ownership
    const module = await Module.findById(lesson.module).session(session);
    if (!module) {
        throw new NotFoundError("Associated module not found");
    }

    await verifyCourseOwnership(module.course, user);

    // Parent Module must not be archived
    if (module.status === "archived") {
        throw new BadRequestError(
            "Cannot publish a lesson under an archived module"
        );
    }

    // Validate required content exists for the lesson type
    validateLessonContent(lesson);

    lesson.status = LESSON_STATUS_ENUM.PUBLISHED;

    session ? await lesson.save({ session }) : await lesson.save();

    return lesson;
};

// ── Archive Lesson ─────────────────────────────────────────

/**
 * Archives a lesson (simple state transition).
 *
 * Future enhancement: Prevent archiving if an active live session
 * is scheduled for this lesson.
 *
 * @param   {string}  lessonId
 * @param   {object}  user
 * @param   {object}  [session]
 * @returns {Promise<object>}
 */
export const archiveLesson = async (lessonId, user, session = null) => {
    const lesson = await Lesson.findById(lessonId).session(session);

    if (!lesson || lesson.isDeleted) {
        throw new NotFoundError("Lesson not found");
    }

    const module = await Module.findById(lesson.module).session(session);
    if (!module) {
        throw new NotFoundError("Associated module not found");
    }

    await verifyCourseOwnership(module.course, user);

    lesson.status = LESSON_STATUS_ENUM.ARCHIVED;

    session ? await lesson.save({ session }) : await lesson.save();

    return lesson;
};

// ── Delete Lesson (Soft) ───────────────────────────────────

/**
 * Soft-deletes a lesson — marks it as deleted rather than
 * permanently removing it.
 *
 * @param   {string}  lessonId
 * @param   {object}  user
 * @param   {object}  [session]
 * @returns {Promise<object>}
 */
export const deleteLesson = async (lessonId, user, session = null) => {
    // Start a transaction if no session was provided, so that the
    // soft-delete and order reindex are atomic.
    const ownsSession = !session;
    if (ownsSession) {
        session = await mongoose.startSession();
        session.startTransaction();
    }

    try {
        const lesson = await Lesson.findById(lessonId).session(session);

        if (!lesson || lesson.isDeleted) {
            throw new NotFoundError("Lesson not found");
        }

        const module = await Module.findById(lesson.module).session(session);
        if (!module) {
            throw new NotFoundError("Associated module not found");
        }

        await verifyCourseOwnership(module.course, user);

        lesson.isDeleted = true;
        lesson.deletedAt = new Date();

        await lesson.save({ session });

        // Reindex: decrement orders of all subsequent active lessons
        // in the same module to keep ordering contiguous.
        await Lesson.updateMany(
            {
                module: lesson.module,
                order: { $gt: lesson.order },
                isDeleted: false,
            },
            { $inc: { order: -1 } },
            { session }
        );

        if (ownsSession) {
            await session.commitTransaction();
        }

        // Deleting a lesson changes the course's lesson/duration totals — refresh.
        await refreshCourseStats(module.course);

        return { id: lessonId, deleted: true };
    } catch (error) {
        if (ownsSession) {
            await session.abortTransaction();
        }
        throw error;
    } finally {
        if (ownsSession) {
            session.endSession();
        }
    }
};

// ── Reorder Lessons ────────────────────────────────────────

/**
 * Reorders lessons within a module using a single bulkWrite
 * operation for atomicity and performance.
 *
 * Input:
 *   [
 *     { lessonId: "...", order: 1 },
 *     { lessonId: "...", order: 2 },
 *   ]
 *
 * @param   {string}  moduleId
 * @param   {Array<{lessonId: string, order: number}>}  lessons
 * @param   {object}  user
 * @param   {object}  [session]
 * @returns {Promise<Array>}
 */
export const reorderLessons = async (moduleId, lessons, user, session = null) => {
    // Verify the module exists
    const module = await Module.findById(moduleId).session(session);
    if (!module) {
        throw new NotFoundError("Module not found");
    }

    // Verify ownership
    await verifyCourseOwnership(module.course, user);

    // Validate that all provided lessonIds belong to this module
    const lessonIds = lessons.map((item) => item.lessonId);

    const existingLessons = await Lesson.find({
        _id: { $in: lessonIds },
        module: moduleId,
    })
        .session(session)
        .select("_id");

    if (existingLessons.length !== lessonIds.length) {
        throw new BadRequestError(
            "One or more lessons do not belong to the specified module"
        );
    }

    // Validate all orders are positive integers
    const orders = lessons.map((item) => item.order);
    if (orders.some((o) => !Number.isInteger(o) || o < 1)) {
        throw new BadRequestError("All orders must be positive integers.");
    }

    // Validate all orders are unique
    if (new Set(orders).size !== orders.length) {
        throw new BadRequestError("Duplicate orders are not allowed.");
    }

    // Two-phase reorder with sequential updates to avoid transient
    // unique-index conflicts.
    //
    // Phase 1: move affected lessons to unique temp values using a
    //          Date.now() offset (guaranteed collision-free).
    // Phase 2: assign the final orders.
    //
    // Sequential updates ensure Phase 1 fully vacates the target
    // positions before Phase 2 begins.

    const TEMP_BASE = Date.now();

    // Phase 1 — Unique temporary values (sequential)
    for (let i = 0; i < lessons.length; i++) {
        await Lesson.updateOne(
            { _id: lessons[i].lessonId, module: moduleId },
            { $set: { order: TEMP_BASE + i } },
            session ? { session } : {}
        );
    }

    // Phase 2 — Final positive orders (sequential)
    for (const item of lessons) {
        await Lesson.updateOne(
            { _id: item.lessonId, module: moduleId },
            { $set: { order: item.order } },
            session ? { session } : {}
        );
    }

    // Return the updated list in the new order
    return Lesson.find({ module: moduleId }).session(session).sort({ order: 1 });
};
