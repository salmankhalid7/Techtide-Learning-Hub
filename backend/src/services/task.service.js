/**
 * @file task.service.js
 * @description Business logic for LearnX AI tasks/assignments, including
 * instructor management (CRUD, publish/archive, reorder), student submission,
 * and AI evaluation with instructor regrade.
 */

import mongoose from "mongoose";
import slugify from "slugify";

import Task from "../models/task.model.js";
import Module from "../models/module.model.js";
import Course from "../models/course.model.js";
import Lesson from "../models/lesson.model.js";
import Enrollment from "../models/enrollment.model.js";
import Progress from "../models/progress.model.js";
import TaskSubmission from "../models/taskSubmission.model.js";

import { verifyCourseOwnership } from "../helpers/ownership.helper.js";
import { evaluateTaskSubmission } from "../helpers/taskAiEvaluation.helper.js";
import { refreshCourseStats } from "../helpers/courseStats.helper.js";

import {
    NotFoundError,
    BadRequestError,
    ForbiddenError,
} from "../errors/index.js";

import logger from "../config/logger.js";
import { notifyUser } from "./notification.service.js";
import { NOTIFICATION_TYPES } from "../constants/notification.constants.js";
import emailService from "./email.service.js";
import User from "../models/user.model.js";

import {
    TASK_STATUS,
    AI_EVALUATION_STATUS,
    TASK_SUBMISSION_STATUS,
} from "../constants/task.constants.js";
import { ENROLLMENT_STATUS } from "../constants/enrollment.constants.js";

const ACTIVE_TASK_FILTER = { deletedAt: null };

/* ------------------------------------------------------------------------ */
/* Small shared helpers                                                      */
/* ------------------------------------------------------------------------ */

/**
 * Pagination helper (mirrors other content services).
 */
export const getPagination = (query = {}) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};

const SORT_FIELDS = ["order", "createdAt", "updatedAt", "title", "status"];
export const parseSort = (sortBy = "order") => {
    const desc = sortBy.startsWith("-");
    const field = desc ? sortBy.slice(1) : sortBy;
    if (!SORT_FIELDS.includes(field)) return { order: 1 };
    return { [field]: desc ? -1 : 1 };
};

/**
 * Instructor-unique slug generation (mirrors quiz.service).
 */
const _generateUniqueSlug = async (title, instructorId) => {
    const baseSlug = slugify(title, { lower: true, strict: true, trim: true });
    let slug = baseSlug;
    let counter = 1;
    while (
        await Task.exists({
            instructor: instructorId,
            slug,
            ...ACTIVE_TASK_FILTER,
        })
    ) {
        slug = `${baseSlug}-${counter++}`;
    }
    return slug;
};

const _getNextTaskOrder = async (moduleId) => {
    const lastTask = await Task.findOne({
        module: moduleId,
        ...ACTIVE_TASK_FILTER,
    })
        .sort({ order: -1 })
        .select("order")
        .lean();
    return lastTask ? lastTask.order + 1 : 1;
};

/**
 * Recompute a module's denormalised `stats.assignmentCount` from live tasks.
 * Idempotent — safe after any create/delete.
 */
const _refreshModuleAssignmentCount = async (moduleId) => {
    const count = await Task.countDocuments({
        module: moduleId,
        ...ACTIVE_TASK_FILTER,
    });
    await Module.updateOne(
        { _id: moduleId },
        { $set: { "stats.assignmentCount": count } }
    );
};

/**
 * Fetch a task and verify instructor ownership through the module → course
 * chain (or admin privilege).
 */
const _getTaskByRole = async ({ taskId, user, lean = false, populate = false }) => {
    let query = Task.findOne({ _id: taskId, ...ACTIVE_TASK_FILTER });
    if (populate) {
        query = query.populate("course", "title status instructor");
    }
    const task = lean ? await query.lean() : await query;
    if (!task) throw new NotFoundError("Task not found");

    const courseOwner = course => {
        if (user.role === "admin") return true;
        return Boolean(course && String(course.instructor) === String(user.id || user._id));
    };

    const courseId = task.course?._id || task.course;
    const course = await Course.findById(courseId).select("_id instructor").lean();
    if (!course) throw new NotFoundError("Associated course not found");
    if (!courseOwner(course)) {
        throw new ForbiddenError("You are not authorized to access this task.");
    }
    return task;
};

/**
 * Verify a student is actively enrolled in the task's course.
 */
const _assertEnrolledStudent = async (courseId, studentId) => {
    const enrollment = await Enrollment.findOne({
        course: courseId,
        student: studentId,
        status: ENROLLMENT_STATUS.ACTIVE,
    }).select("_id course student");
    if (!enrollment) {
        throw new ForbiddenError("You must be enrolled in this course to access its assignments.");
    }
    return enrollment;
};

/**
 * Validate that a passingScore <= maxScore after resolving the rubric total.
 */
const _validateScores = (task, data, requireMax = false) => {
    const maxScore = Number(data.maxScore ?? task.maxScore);
    const passingScore = Number(data.passingScore ?? task.passingScore);

    if (requireMax || maxScore > 0) {
        if (passingScore > maxScore) {
            throw new BadRequestError("Passing score cannot exceed maximum score.");
        }
    }
    return { maxScore, passingScore };
};

/* ------------------------------------------------------------------------ */
/* Instructor: Task CRUD                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Create a task inside a module.
 *
 * @param {Object} params
 * @param {string} params.moduleId
 * @param {Object} params.user
 * @param {Object} params.data  - { course, module, title, description, instructions,
 *                                 taskType, difficulty, maxScore, passingScore,
 *                                 rubric, submissionSettings, dueDate, order, lesson }
 */
export const createTask = async ({ moduleId, user, data }) => {
    logger.info(`Creating task for module: ${moduleId}`);

    const module = await Module.findById(moduleId);
    if (!module) throw new NotFoundError("Module not found");
    const course = await verifyCourseOwnership(module.course, user, "create tasks in this course");

    // The module must belong to the supplied course (defence against mismatch).
    if (data.course && String(data.course) !== String(module.course)) {
        throw new BadRequestError("Module does not belong to the given course.");
    }

    // Optional lesson must belong to the same module, if provided.
    let lessonId = data.lesson || null;
    if (lessonId) {
        const lesson = await Lesson.findOne({ _id: lessonId, module: moduleId, isDeleted: false })
            .select("_id");
        if (!lesson) {
            throw new BadRequestError("Lesson does not belong to the given module.");
        }
    }

    const { maxScore, passingScore } = _validateScores(
        {},
        { maxScore: data.maxScore, passingScore: data.passingScore },
        true
    );

    const instructorId = course.instructor;
    const slug = await _generateUniqueSlug(data.title, instructorId);
    const order = data.order ?? (await _getNextTaskOrder(moduleId));

    const task = await Task.create({
        course: module.course,
        module: module._id,
        lesson: lessonId,
        instructor: instructorId,
        title: data.title,
        slug,
        description: data.description ?? "",
        instructions: data.instructions ?? "",
        taskType: data.taskType,
        difficulty: data.difficulty ?? undefined,
        maxScore,
        passingScore,
        rubric: data.rubric ?? [],
        submissionSettings: data.submissionSettings ?? undefined,
        dueDate: data.dueDate ?? null,
        order,
        status: TASK_STATUS.DRAFT,
        createdBy: user.id,
    });

    await _refreshModuleAssignmentCount(moduleId);

    logger.info(`Task created successfully: ${task._id}`);
    return task;
};

/**
 * Update an existing task.
 */
export const updateTask = async ({ taskId, user, data }) => {
    logger.info(`Updating task: ${taskId}`);

    const task = await _getTaskByRole({ taskId, user });
    if (task.status === TASK_STATUS.PUBLISHED) {
        throw new BadRequestError("Published tasks cannot be edited. Archive the task first.");
    }

    if (data.title && data.title !== task.title) {
        task.slug = await _generateUniqueSlug(data.title, task.instructor);
        task.title = data.title;
    }

    const scalarFields = [
        "description", "instructions", "taskType", "difficulty",
        "dueDate", "order", "lesson", "maxScore", "passingScore",
    ];
    for (const f of scalarFields) {
        if (data[f] !== undefined) task[f] = data[f];
    }

    if (data.rubric !== undefined) task.rubric = data.rubric;
    if (data.submissionSettings !== undefined) {
        task.submissionSettings = {
            ...(task.submissionSettings?.toObject?.() ?? task.submissionSettings ?? {}),
            ...data.submissionSettings,
        };
    }

    if (data.maxScore !== undefined || data.passingScore !== undefined) {
        _validateScores(task, data);
    }

    task.updatedBy = user.id;
    await task.save();

    logger.info(`Task updated successfully: ${task._id}`);
    return task;
};

/**
 * Get a single task (instructor/admin).
 */
export const getTask = async ({ taskId, user }) => {
    logger.info(`Fetching task: ${taskId}`);
    const task = await _getTaskByRole({
        taskId,
        user,
        lean: true,
        populate: true,
    });
    return task;
};

/**
 * List tasks for a module (instructor/admin).
 */
export const getModuleTasks = async ({ moduleId, user, query }) => {
    logger.info(`Fetching tasks for module: ${moduleId}`);

    const module = await Module.findById(moduleId);
    if (!module) throw new NotFoundError("Module not found");
    await verifyCourseOwnership(module.course, user, "view tasks in this course");

    const { page, limit, skip } = getPagination(query);
    const sort = parseSort(query.sortBy);

    const filter = { module: moduleId, ...ACTIVE_TASK_FILTER };
    if (query.status) filter.status = query.status;

    const [tasks, total] = await Promise.all([
        Task.find(filter)
            .select("title slug taskType status order maxScore passingScore dueDate createdAt")
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        Task.countDocuments(filter),
    ]);

    return {
        tasks,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Publish a task. Requires a rubric (for AI evaluation) if one is not present.
 */
export const publishTask = async ({ taskId, user }) => {
    logger.info(`Publishing task: ${taskId}`);

    const task = await _getTaskByRole({ taskId, user });
    if (task.status === TASK_STATUS.PUBLISHED) {
        throw new BadRequestError("Task is already published.");
    }

    // Rubric strongly recommended for meaningful AI evaluation.
    if (!Array.isArray(task.rubric) || task.rubric.length === 0) {
        throw new BadRequestError("Task must define a rubric before publishing (needed for AI evaluation).");
    }

    task.status = TASK_STATUS.PUBLISHED;
    task.publishedAt = new Date();
    task.updatedBy = user.id;
    await task.save();

    logger.info(`Task published successfully: ${task._id}`);
    return task;
};

/**
 * Archive a task.
 */
export const archiveTask = async ({ taskId, user }) => {
    logger.info(`Archiving task: ${taskId}`);

    const task = await _getTaskByRole({ taskId, user });
    if (task.status === TASK_STATUS.ARCHIVED) {
        throw new BadRequestError("Task is already archived.");
    }

    task.status = TASK_STATUS.ARCHIVED;
    task.archivedAt = new Date();
    task.updatedBy = user.id;
    await task.save();

    logger.info(`Task archived successfully: ${task._id}`);
    return task;
};

/**
 * Soft delete a task and reindex remaining orders.
 */
export const deleteTask = async ({ taskId, user }) => {
    logger.info(`Deleting task: ${taskId}`);

    const task = await _getTaskByRole({ taskId, user });

    task.deletedAt = new Date();
    task.updatedBy = user.id;
    await task.save();

    await _reindexTaskOrders(task.module);
    await _refreshModuleAssignmentCount(task.module);

    logger.info(`Task deleted successfully: ${task._id}`);
};

const _reindexTaskOrders = async (moduleId) => {
    const tasks = await Task.find({ module: moduleId, ...ACTIVE_TASK_FILTER })
        .sort({ order: 1 })
        .select("_id order");

    if (!tasks.length) return;

    await Task.bulkWrite(
        tasks.map((t, i) => ({
            updateOne: {
                filter: { _id: t._id },
                update: { $set: { order: i + 1 } },
            },
        }))
    );
};

/**
 * Reorder tasks within a module (two-phase to avoid unique-index collisions).
 */
export const reorderTasks = async ({ moduleId, user, tasks }) => {
    logger.info(`Reordering tasks for module: ${moduleId}`);

    const module = await Module.findById(moduleId);
    if (!module) throw new NotFoundError("Module not found");
    await verifyCourseOwnership(module.course, user, "reorder tasks in this course");

    const ids = tasks.map((t) => t.taskId);
    const orders = tasks.map((t) => t.order);

    if (new Set(ids).size !== ids.length) {
        throw new BadRequestError("Duplicate task IDs are not allowed.");
    }
    if (new Set(orders).size !== orders.length) {
        throw new BadRequestError("Duplicate task orders are not allowed.");
    }
    if (orders.some((o) => !Number.isInteger(o) || o < 1)) {
        throw new BadRequestError("All orders must be positive integers.");
    }

    const sorted = [...orders].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] !== i + 1) {
            throw new BadRequestError("Task orders must be sequential (1, 2, 3, …).");
        }
    }

    const totalTasks = await Task.countDocuments({
        module: moduleId,
        ...ACTIVE_TASK_FILTER,
    });
    if (tasks.length !== totalTasks) {
        throw new BadRequestError("All tasks in the module must be included in the reorder request.");
    }

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        await Task.bulkWrite(
            tasks.map((t, i) => ({
                updateOne: {
                    filter: { _id: t.taskId, module: moduleId, ...ACTIVE_TASK_FILTER },
                    update: { $set: { order: -(i + 1) } },
                },
            })),
            { session }
        );

        await Task.bulkWrite(
            tasks.map((t) => ({
                updateOne: {
                    filter: { _id: t.taskId, module: moduleId, ...ACTIVE_TASK_FILTER },
                    update: { $set: { order: t.order } },
                },
            })),
            { session }
        );

        await session.commitTransaction();
    } catch (err) {
        await session.abortTransaction();
        throw err;
    } finally {
        session.endSession();
    }

    return Task.find({ module: moduleId, ...ACTIVE_TASK_FILTER })
        .sort({ order: 1 })
        .select("_id title order status")
        .lean();
};

/* ------------------------------------------------------------------------ */
/* Student: access & submission                                              */
/* ------------------------------------------------------------------------ */

/**
 * Get a published task for an enrolled student (lean, for consumption).
 */
export const getStudentTask = async ({ taskId, user }) => {
    const task = await Task.findOne({ _id: taskId, ...ACTIVE_TASK_FILTER })
        .populate("course", "title slug instructor")
        .lean();

    if (!task || task.status !== TASK_STATUS.PUBLISHED) {
        throw new NotFoundError("Task not found");
    }

    await _assertEnrolledStudent(task.course._id, user.id);
    return task;
};

/**
 * Get the authenticated student's latest submission for a task, or null.
 */
export const getMySubmission = async ({ taskId, user }) => {
    const task = await Task.findOne({ _id: taskId, ...ACTIVE_TASK_FILTER }).lean();
    if (!task) throw new NotFoundError("Task not found");
    await _assertEnrolledStudent(task.course, user.id);

    const submission = await TaskSubmission.findOne({
        task: taskId,
        student: user.id,
    })
        .sort({ attemptNumber: -1 })
        .lean();

    return submission || null;
};

/**
 * Get the student's full submission history for a task.
 */
export const getMyTaskSubmissions = async ({ taskId, user, query }) => {
    const task = await Task.findOne({ _id: taskId, ...ACTIVE_TASK_FILTER }).lean();
    if (!task) throw new NotFoundError("Task not found");
    await _assertEnrolledStudent(task.course, user.id);

    const { page, limit, skip } = getPagination(query);
    const filter = { task: taskId, student: user.id };

    const [submissions, total] = await Promise.all([
        TaskSubmission.find(filter)
            .sort({ attemptNumber: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        TaskSubmission.countDocuments(filter),
    ]);

    return {
        submissions,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Submit (or update a draft of) a task.
 *
 * - If a DRAFT submission exists for the current attempt, it is updated.
 * - Otherwise a new attempt is created (respecting attempt limit).
 * - On final submission, AI evaluation runs and the submission becomes graded.
 *
 * @param {Object} params
 * @param {string} params.taskId
 * @param {Object} params.user
 * @param {Object} params.data - { content, isFinal }
 */
export const submitTask = async ({ taskId, user, data }) => {
    logger.info(`Student ${user.id} submitting task: ${taskId}`);

    const task = await Task.findOne({ _id: taskId, ...ACTIVE_TASK_FILTER });
    if (!task || task.status !== TASK_STATUS.PUBLISHED) {
        throw new NotFoundError("Task not found");
    }

    const enrollment = await _assertEnrolledStudent(task.course, user.id);
    const isFinal = data.isFinal !== false;

    const attemptLimit = task.submissionSettings?.attemptLimit ?? 1;

    // Locate the open (DRAFT) submission for this attempt, if any.
    let submission = await TaskSubmission.findOne({
        task: taskId,
        student: user.id,
        status: TASK_SUBMISSION_STATUS.DRAFT,
    }).sort({ attemptNumber: -1 });

    if (!submission) {
        // No draft — check we have attempts left.
        const completedAttempts = await TaskSubmission.countDocuments({
            task: taskId,
            student: user.id,
            status: { $ne: TASK_SUBMISSION_STATUS.DRAFT },
        });

        if (completedAttempts >= attemptLimit) {
            throw new BadRequestError("Submission attempt limit reached for this task.");
        }

        const latest = await TaskSubmission.findOne({ task: taskId, student: user.id })
            .sort({ attemptNumber: -1 })
            .select("attemptNumber")
            .lean();

        submission = await TaskSubmission.create({
            task: taskId,
            course: task.course,
            module: task.module,
            student: user.id,
            enrollment: enrollment._id,
            instructor: task.instructor,
            attemptNumber: (latest?.attemptNumber ?? 0) + 1,
            content: data.content ?? {},
            status: TASK_SUBMISSION_STATUS.DRAFT,
        });
    } else {
        // Update existing draft content.
        submission.content = {
            ...(submission.content?.toObject?.() ?? submission.content ?? {}),
            ...(data.content ?? {}),
        };
    }

    // Compute lateness against due date.
    if (task.dueDate && new Date(task.dueDate) < new Date()) {
        const allowLate = task.submissionSettings?.allowLateSubmission === true;
        if (!allowLate) {
            throw new BadRequestError("Submission deadline has passed and late submissions are not allowed.");
        }
        submission.isLate = true;
    }

    // If final, transition to EVALUATING → AI evaluate → EVALUATED/GRADED.
    if (isFinal) {
        submission.status = TASK_SUBMISSION_STATUS.EVALUATING;
        submission.submittedAt = new Date();

        await _runAiEvaluation(submission, task, user);

        submission.status = await _finalizeSubmission(submission, task);
        submission.gradedAt = new Date();

        await submission.save();
        await _recordTaskCompletionInProgress(submission, task, user);

        logger.info(`Task evaluated: ${submission._id} score=${submission.finalScore}`);

        // Notify the student their task was evaluated.
        await notifyUser({
            recipient: user.id,
            type: NOTIFICATION_TYPES.TASK_EVALUATED,
            title: "Task evaluated",
            body: `Your submission for "${task.title}" was graded: score ${submission.finalScore}/${task.maxScore}`,
            data: { task: task._id, submission: submission._id, course: task.course, score: submission.finalScore },
        });

        // ── Best-effort task evaluation email (never break grading) ──
        try {
            const student = await User.findById(user.id).select("email fullName").lean();
            if (student?.email) {
                await emailService.sendTaskEvaluation({
                    to: student.email,
                    fullName: student.fullName || "there",
                    taskName: task.title || "Task",
                    score: submission.finalScore,
                    maxScore: task.maxScore,
                });
            }
        } catch (e) {
            logger.warn("Task evaluation email skipped.", { error: e.message });
        }
    } else {
        submission.status = TASK_SUBMISSION_STATUS.DRAFT;
        await submission.save();
    }

    return submission;
};

/**
 * Run the AI evaluator and persist results on the submission.
 */
const _runAiEvaluation = async (submission, task, user) => {
    submission.aiEvaluation.status = AI_EVALUATION_STATUS.PROCESSING;

    try {
        const result = await evaluateTaskSubmission({
            task: task.toObject(),
            submissionContent: submission.content?.toObject?.() ?? submission.content ?? {},
            model: `heuristic-rules-v1`,
        });

        submission.aiEvaluation.status = AI_EVALUATION_STATUS.COMPLETED;
        submission.aiEvaluation.score = result.score;
        submission.aiEvaluation.maxScore = task.maxScore;
        submission.aiEvaluation.percentage = result.percentage;
        submission.aiEvaluation.rubricResults = result.rubricResults;
        submission.aiEvaluation.feedback = result.feedback;
        submission.aiEvaluation.strengths = result.strengths;
        submission.aiEvaluation.improvements = result.improvements;
        submission.aiEvaluation.confidence = result.confidence;
        submission.aiEvaluation.model = result.model;
        submission.aiEvaluation.evaluatedAt = new Date();
        submission.aiEvaluation.error = "";

        submission.finalScore = result.score;
        submission.finalPercentage = result.percentage;
        submission.isPassed =
            result.percentage >= Number(task.passingScore) ||
            result.score >= Number(task.passingScore);
        submission.gradedBy = null; // AI-graded by default
    } catch (err) {
        logger.error("AI evaluation failed for submission", {
            submissionId: submission._id,
            error: err.message,
        });
        submission.aiEvaluation.status = AI_EVALUATION_STATUS.FAILED;
        submission.aiEvaluation.error = err.message;
        submission.status = TASK_SUBMISSION_STATUS.EVALUATING;
        throw err;
    }
};

/**
 * Determine the final submission status based on evaluation success.
 */
const _finalizeSubmission = async (submission, task) => {
    if (submission.aiEvaluation.status === AI_EVALUATION_STATUS.COMPLETED) {
        return TASK_SUBMISSION_STATUS.GRADED;
    }
    return TASK_SUBMISSION_STATUS.SUBMITTED;
};

/**
 * Record task completion in the student's Progress metadata so dashboards
 * can reflect completed assignments. Non-destructive to lesson-based pct.
 */
const _recordTaskCompletionInProgress = async (submission, task, user) => {
    try {
        const completed = submission.isPassed === true;
        if (!completed) return;

        const progress = await Progress.findOne({
            student: user.id,
            course: submission.course,
        });

        if (!progress) return;

        const completedTasks = Array.isArray(progress.metadata?.completedTasks)
            ? progress.metadata.completedTasks
            : [];

        if (!completedTasks.map(String).includes(String(task._id))) {
            completedTasks.push(task._id);
            progress.metadata = { ...(progress.metadata ?? {}), completedTasks };
            await progress.save();
        }
    } catch (err) {
        logger.error("Failed to record task completion in progress", {
            submissionId: submission._id,
            error: err.message,
        });
    }
};

/* ------------------------------------------------------------------------ */
/* Instructor: submissions & regrade                                         */
/* ------------------------------------------------------------------------ */

/**
 * Instructor lists all submissions for a task.
 */
export const getTaskSubmissions = async ({ taskId, user, query }) => {
    const task = await _getTaskByRole({ taskId, user, lean: true });
    const { page, limit, skip } = getPagination(query);

    // Status filter must be a valid submission status.
    const status = query.status;
    const filter = { task: taskId };
    if (status) filter.status = status;

    const [submissions, total] = await Promise.all([
        TaskSubmission.find(filter)
            .populate("student", "fullName email avatar")
            .sort({ submittedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        TaskSubmission.countDocuments(filter),
    ]);

    return {
        submissions,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
};

/**
 * Instructor views a single submission (with ownership check).
 */
export const getSubmission = async ({ taskId, submissionId, user }) => {
    const task = await _getTaskByRole({ taskId, user, lean: true });

    const submission = await TaskSubmission.findOne({
        _id: submissionId,
        task: taskId,
    })
        .populate("student", "fullName email avatar")
        .lean();

    if (!submission) throw new NotFoundError("Submission not found");
    return submission;
};

/**
 * Instructor manually regrades / overrides a submission.
 *
 * @param {Object} params
 * @param {string} params.taskId
 * @param {string} params.submissionId
 * @param {Object} params.user
 * @param {Object} params.data - { score, feedback, comment }
 */
export const regradeSubmission = async ({ taskId, submissionId, user, data }) => {
    const task = await _getTaskByRole({ taskId, user });

    const submission = await TaskSubmission.findOne({
        _id: submissionId,
        task: taskId,
    });
    if (!submission) throw new NotFoundError("Submission not found");

    if (Number(data.score) > Number(task.maxScore)) {
        throw new BadRequestError("Regrade score cannot exceed the task's maximum score.");
    }

    submission.regrade = {
        ...(submission.regrade?.toObject?.() ?? submission.regrade ?? {}),
        score: Number(data.score),
        feedback: data.feedback ?? "",
        comment: data.comment ?? "",
        regradedBy: user.id,
        regradedAt: new Date(),
    };

    // Override the final score with the instructor's score.
    submission.finalScore = Number(data.score);
    submission.finalPercentage = Number(
        ((Number(data.score) / Number(task.maxScore)) * 100).toFixed(2)
    );
    submission.isPassed = submission.finalPercentage >= Number(task.passingScore);
    submission.status = TASK_SUBMISSION_STATUS.GRADED;
    submission.gradedBy = user.id;
    submission.gradedAt = new Date();

    await submission.save();
    await _recordTaskCompletionInProgress(submission, task, user);

    logger.info(`Submission regraded: ${submission._id}`);
    return submission;
};
