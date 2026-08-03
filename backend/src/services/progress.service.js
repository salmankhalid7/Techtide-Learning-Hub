/**
 * @file progress.service.js
 * @description Progress business logic — track lessons, modules, course completion.
 */

import mongoose from "mongoose";

import Enrollment from "../models/enrollment.model.js";
import Progress from "../models/progress.model.js";
import Lesson from "../models/lesson.model.js";
import Module from "../models/module.model.js";

import logger from "../config/logger.js";

import { NotFoundError } from "../errors/index.js";

import { ENROLLMENT_STATUS } from "../constants/enrollment.constants.js";
import { LESSON_STATUS } from "../constants/lesson.constants.js";
import { MODULE_STATUS } from "../constants/module.constants.js";

// ── Data fetchers ─────────────────────────────────────────────────────────

/** Fetch an active enrollment for a student–course pair. */
async function _getEnrollment(courseId, studentId, session) {
    const enrollment = await Enrollment.findOne({
        course: courseId,
        student: studentId,
        status: ENROLLMENT_STATUS.ACTIVE,
    }).session(session);

    if (!enrollment) {
        throw new NotFoundError("Active enrollment not found.");
    }

    return enrollment;
}

/** Fetch a progress doc by enrollment ID. */
async function _getProgress(enrollmentId, session) {
    const progress = await Progress.findOne({
        enrollment: enrollmentId,
    }).session(session);

    if (!progress) {
        throw new NotFoundError("Progress record not found.");
    }

    return progress;
}

/** Fetch a published lesson by ID. */
async function _getLesson(lessonId, session) {
    const lesson = await Lesson.findOne({
        _id: lessonId,
        status: LESSON_STATUS.PUBLISHED,
    }).session(session);

    if (!lesson) {
        throw new NotFoundError("Lesson not found.");
    }

    return lesson;
}

/** Fetch a published module by ID. */
async function _getModule(moduleId, session) {
    const module = await Module.findOne({
        _id: moduleId,
        status: MODULE_STATUS.PUBLISHED,
    }).session(session);

    if (!module) {
        throw new NotFoundError("Module not found.");
    }

    return module;
}

// ── Completion calculation ────────────────────────────────────────────────

/**
 * Fetch all published modules for a course.
 * @param {mongoose.Types.ObjectId} courseId
 * @param {mongoose.ClientSession} session
 * @returns {Promise<Object[]>} lean modules with _id
 */
async function _getCourseModules(courseId, session) {
    return Module.find({
        course: courseId,
        status: MODULE_STATUS.PUBLISHED,
    })
        .select("_id")
        .lean()
        .session(session);
}

/**
 * Group an array of lean lessons into a Map keyed by module ID.
 * @param {Object[]} lessons — lean docs with _id and module
 * @returns {Map<string, Object[]>}
 */
function _groupLessonsByModule(lessons) {
    const map = new Map();
    for (const lesson of lessons) {
        const key = lesson.module.toString();
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(lesson);
    }
    return map;
}

/**
 * Fetch all published lessons for the given modules, grouped by module ID.
 * Returns only _id values — use _groupLessonsByModule for full lesson objects.
 * @param {mongoose.Types.ObjectId[]} moduleIds
 * @param {mongoose.ClientSession} session
 * @returns {Promise<Map<string, mongoose.Types.ObjectId[]>>}
 */
async function _getLessonsByModule(moduleIds, session) {
    const lessons = await Lesson.find({
        module: { $in: moduleIds },
        status: LESSON_STATUS.PUBLISHED,
    })
        .select("_id module")
        .lean()
        .session(session);

    const map = new Map();
    for (const { _id, module } of lessons) {
        const key = module.toString();
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(_id);
    }
    return map;
}

/**
 * Determine which modules are fully completed.
 * O(n) — single pass over modules, O(1) lesson lookup via pre-built map.
 *
 * @param {Object[]} modules — lean { _id }
 * @param {Map<string, mongoose.Types.ObjectId[]>} lessonsByModule
 * @param {mongoose.Types.ObjectId[]} completedLessonIds
 * @returns {mongoose.Types.ObjectId[]}
 */
function _calculateModuleCompletion(modules, lessonsByModule, completedLessonIds) {
    const completedStr = new Set(completedLessonIds.map((id) => id.toString()));

    return modules
        .filter((m) => {
            const lids = lessonsByModule.get(m._id.toString());
            return lids && lids.length > 0 && lids.every((lid) => completedStr.has(lid.toString()));
        })
        .map((m) => m._id);
}

/**
 * Compute overall course completion percentage (0–100).
 * O(1) — sums pre-grouped lesson counts from the map.
 *
 * @param {Map<string, mongoose.Types.ObjectId[]>} lessonsByModule
 * @param {mongoose.Types.ObjectId[]} completedLessonIds
 * @returns {number}
 */
function _calculateCourseCompletion(lessonsByModule, completedLessonIds) {
    let total = 0;
    for (const lids of lessonsByModule.values()) {
        total += lids.length;
    }

    if (total === 0) return 0;

    return Math.round((completedLessonIds.length / total) * 100);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Update a student's lesson progress.
 * Marks the lesson complete, recalculates module/course completion,
 * and updates the enrollment if the course is finished.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.lessonId
 * @param {mongoose.Types.ObjectId|string} params.studentId
 * @param {boolean} [params.completed=true]
 * @returns {Promise<Progress>}
 */
export async function updateLessonProgress({
    lessonId,
    studentId,
    completed = true,
}) {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const lesson = await _getLesson(lessonId, session);
        const module = await _getModule(lesson.module, session);
        const enrollment = await _getEnrollment(module.course, studentId, session);
        const progress = await _getProgress(enrollment._id, session);

        const courseId = enrollment.course;

        // ── Resume position ──────────────────────────────────────────

        progress.currentModule = module._id;
        progress.currentLesson = lesson._id;
        progress.lastAccessedLesson = lesson._id;
        progress.lastAccessedAt = new Date();

        // ── Mark lesson complete ─────────────────────────────────────

        if (completed) {
            const alreadyDone = progress.hasCompletedLesson(lesson._id);
            if (!alreadyDone) {
                progress.completedLessons.push(lesson._id);

                await Lesson.updateOne(
                    { _id: lesson._id },
                    { $inc: { "analytics.completions": 1 } },
                    { session }
                );
            }
        }

        // ── Recalculate completion ───────────────────────────────────

        const modules = await _getCourseModules(courseId, session);
        const lessonsByModule = await _getLessonsByModule(
            modules.map((m) => m._id),
            session
        );

        progress.completedModules = _calculateModuleCompletion(
            modules, lessonsByModule, progress.completedLessons
        );
        progress.completionPercentage = _calculateCourseCompletion(
            lessonsByModule, progress.completedLessons
        );

        if (progress.completionPercentage === 100) {
            progress.completedAt ??= new Date();
            enrollment.status = ENROLLMENT_STATUS.COMPLETED;
            enrollment.completedAt = new Date();
        }

        enrollment.lastAccessedAt = new Date();

        await progress.save({ session });
        await enrollment.save({ session });
        await session.commitTransaction();

        logger.info("Lesson progress updated.", {
            lessonId,
            studentId,
            courseId,
            moduleId: module._id,
            enrollmentId: enrollment._id,
        });

        return progress;
    } catch (error) {
        await session.abortTransaction();
        logger.error("Failed to update lesson progress.", {
            lessonId,
            studentId,
            error: error.message,
        });
        throw error;
    } finally {
        await session.endSession();
    }
}

/**
 * Retrieve a student's progress for a specific lesson.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.lessonId
 * @param {mongoose.Types.ObjectId|string} params.studentId
 * @returns {Promise<Object>}
 */
export async function getLessonProgress({ lessonId, studentId }) {
    const lesson = await _getLesson(lessonId);
    const module = await _getModule(lesson.module);
    const enrollment = await _getEnrollment(module.course, studentId);
    const progress = await _getProgress(enrollment._id);

    return {
        lessonId: lesson._id,
        moduleId: module._id,
        courseId: module.course,
        completed: progress.hasCompletedLesson(lesson._id),
        isCurrentLesson:
            progress.currentLesson?.toString() === lesson._id.toString(),
        completionPercentage: progress.completionPercentage,
        lastAccessedAt: progress.lastAccessedAt,
    };
}

/**
 * Retrieve complete module-by-module progress for a course.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.courseId
 * @param {mongoose.Types.ObjectId|string} params.studentId
 * @returns {Promise<Object>}
 */
export async function getCourseProgress({ courseId, studentId }) {
    const enrollment = await _getEnrollment(courseId, studentId);
    const progress = await _getProgress(enrollment._id);

    const modules = await Module.find({
        course: courseId,
        status: MODULE_STATUS.PUBLISHED,
    })
        .select("_id title order")
        .sort({ order: 1 })
        .lean();

    const lessons = await Lesson.find({
        module: { $in: modules.map((m) => m._id) },
        status: LESSON_STATUS.PUBLISHED,
    })
        .select("_id module title order duration lessonType")
        .sort({ order: 1 })
        .lean();

    const lessonsByModule = _groupLessonsByModule(lessons);
    const completedSet = new Set(progress.completedLessons.map(String));

    const moduleProgress = modules.map((mod) => {
        const modLessons = lessonsByModule.get(mod._id.toString()) || [];
        const done = modLessons.filter((l) => completedSet.has(l._id.toString())).length;
        const total = modLessons.length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);

        return {
            moduleId: mod._id,
            title: mod.title,
            totalLessons: total,
            completedLessons: done,
            completionPercentage: pct,
            completed: pct === 100,
        };
    });

    const totalLessons = lessons.length;
    const completedLessons = lessons.filter((l) => completedSet.has(l._id.toString())).length;
    const completionPercentage =
        totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

    return {
        courseId,
        enrollmentStatus: enrollment.status,
        totalModules: modules.length,
        completedModules: moduleProgress.filter((m) => m.completed).length,
        totalLessons,
        completedLessons,
        completionPercentage,
        completed: completionPercentage === 100,
        currentModule: progress.currentModule,
        currentLesson: progress.currentLesson,
        lastAccessedLesson: progress.lastAccessedLesson,
        lastAccessedAt: progress.lastAccessedAt,
        modules: moduleProgress,
    };
}

/**
 * Resume learning — return the next incomplete lesson.
 * Returns null for nextLesson when the course is fully completed.
 *
 * @param {Object} params
 * @param {mongoose.Types.ObjectId|string} params.courseId
 * @param {mongoose.Types.ObjectId|string} params.studentId
 * @returns {Promise<Object>}
 */
export async function resumeLearning({ courseId, studentId }) {
    const enrollment = await _getEnrollment(courseId, studentId);
    const progress = await _getProgress(enrollment._id);

    const modules = await Module.find({
        course: courseId,
        status: MODULE_STATUS.PUBLISHED,
    })
        .select("_id title order")
        .sort({ order: 1 })
        .lean();

    const lessons = await Lesson.find({
        module: { $in: modules.map((m) => m._id) },
        status: LESSON_STATUS.PUBLISHED,
    })
        .select("_id module title order duration lessonType")
        .lean();

    const lessonsByModule = _groupLessonsByModule(lessons);
    const completedSet = new Set(progress.completedLessons.map(String));

    // Iterate modules in course order, then lessons in order within each module
    let nextLesson = null;
    for (const mod of modules) {
        const modLessons = (lessonsByModule.get(mod._id.toString()) || [])
            .sort((a, b) => a.order - b.order);
        const firstIncomplete = modLessons.find(
            (l) => !completedSet.has(l._id.toString())
        );
        if (firstIncomplete) {
            nextLesson = firstIncomplete;
            break;
        }
    }

    if (!nextLesson) {
        return {
            completed: true,
            completionPercentage: progress.completionPercentage,
            currentModule: null,
            currentLesson: null,
            nextLesson: null,
        };
    }

    const currentModule = modules.find(
        (m) => m._id.toString() === nextLesson.module.toString()
    );

    return {
        completed: false,
        completionPercentage: progress.completionPercentage,
        currentModule,
        currentLesson: nextLesson,
        nextLesson,
        lastAccessedLesson: progress.lastAccessedLesson,
        lastAccessedAt: progress.lastAccessedAt,
    };
}