import mongoose from "mongoose";
import Module from "../models/module.model.js";
import Course from "../models/course.model.js";
import {
    COURSE_STATUS,
    COURSE_VISIBILITY,
} from "../constants/course.constants.js";
import { verifyCourseOwnership } from "../helpers/ownership.helper.js";
import { refreshCourseStats } from "../helpers/courseStats.helper.js";
import { NotFoundError, BadRequestError } from "../errors/index.js";

/**
 * A course is publicly browsable only when it is both published and public.
 */
const isCoursePubliclyVisible = (course) =>
    Boolean(
        course &&
        course.status === COURSE_STATUS.PUBLISHED &&
        course.visibility === COURSE_VISIBILITY.PUBLIC
    );

/**
 * Whether a user may access all modules of a course (instructor owner / admin),
 * regardless of publish state. Used to preserve owner/admin management access.
 */
const canAccessAllModules = (course, user) => {
    if (!course) return false;
    if (user?.role === "admin") return true;
    return Boolean(user && String(course.instructor) === String(user._id));
};


/**
 * Create a new module inside a course
 */
export const createModule = async (moduleData, user) => {

    let {
        course,
        title,
        description,
        order,
        estimatedDuration,
        isPreview,
    } = moduleData;


    // Verify the parent course exists and the current user owns it (or is an
    // admin). Only the ownership-relevant Course fields are fetched.
    await verifyCourseOwnership(course, user, "create modules in this course");

    // Auto-assign order if not provided
    if (order === undefined || order === null) {
        const lastModule = await Module.findOne({ course })
            .sort({ order: -1 })
            .select("order");
        order = lastModule ? lastModule.order + 1 : 1;
    }


    const module = await Module.create({
        course,
        title,
        description,
        order,
        estimatedDuration,
        isPreview,
    });


    // A new module changes the course's module/lesson totals — refresh them.
    await refreshCourseStats(course);

    return module;
};

/**
 * Get module by ID
 *
 * Owner/admin access: returns the module regardless of publish state.
 * Public access (H3): the parent course must be published + public AND the
 * module must itself be published and released; otherwise a 404 is returned
 * so no unpublished content is disclosed.
 */
export const getModuleById = async (moduleId, user) => {

    const module = await Module.findById(moduleId)
        .populate("course", "title slug status visibility instructor");

    if (!module) {
        throw new NotFoundError("Module not found");
    }

    // Owner (course instructor) and admins retain full read access.
    if (canAccessAllModules(module.course, user)) {
        return module;
    }

    // Public: course must be published + public AND module published + released.
    const released = (module) =>
        !module.releaseAt || module.releaseAt <= new Date();

    if (
        !isCoursePubliclyVisible(module.course) ||
        module.status !== "published" ||
        !released(module)
    ) {
        throw new NotFoundError("Module not found");
    }

    return module;
};



/**
 * Get all modules of a course
 *
 * Owner/admin access: returns all active modules (including drafts) via the
 * existing `findByCourse` helper — preserves management view.
 * Public access (H3): only returns modules when the parent course is
 * published + public, and only the course's published modules (reuses the
 * existing `findPublishedByCourse` helper). Unpublished/private courses yield
 * an empty list so no content is disclosed.
 */
export const getModulesByCourse = async (courseId, user) => {

    const course = await Course.findById(courseId)
        .select("status visibility instructor");

    if (!course) {
        throw new NotFoundError("Course not found");
    }

    // Owner (course instructor) and admins retain full read access.
    if (canAccessAllModules(course, user)) {
        return Module.findByCourse(courseId).lean();
    }

    // Public: only a published + public course exposes its published modules.
    if (!isCoursePubliclyVisible(course)) {
        return [];
    }

    return Module.findPublishedByCourse(courseId).lean();
};



/**
 * Update module details
 */
export const updateModule = async (
    moduleId,
    updateData,
    user
) => {

    const module = await Module.findById(moduleId);

    if (!module) {
        throw new NotFoundError("Module not found");
    }

    await verifyCourseOwnership(module.course, user, "update this module");

    const allowedFields = [
        "title", "description", "order", "status",
        "isPreview", "isLocked", "estimatedDuration", "releaseAt",
    ];

    for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
            module[field] = updateData[field];
        }
    }

    await module.save();


    return module;
};



/**
 * Publish module
 */
export const publishModule = async (moduleId, user) => {

    const module = await Module.findById(moduleId);

    if (!module) {
        throw new NotFoundError("Module not found");
    }

    await verifyCourseOwnership(module.course, user, "publish this module");

    module.status = "published";


    await module.save();


    return module;
};



/**
 * Archive module
 */
export const archiveModule = async (moduleId, user) => {

    const module = await Module.findById(moduleId);

    if (!module) {
        throw new NotFoundError("Module not found");
    }

    await verifyCourseOwnership(module.course, user, "archive this module");

    module.status = "archived";


    await module.save();


    return module;
};



/**
 * Soft delete module
 */
export const deleteModule = async (moduleId, user) => {

    const module = await Module.findById(moduleId);

    if (!module) {
        throw new NotFoundError("Module not found");
    }

    await verifyCourseOwnership(module.course, user, "delete this module");

    module.deletedAt = new Date();


    await module.save();


    // Deleting a module changes the course's module/lesson totals — refresh.
    await refreshCourseStats(module.course);

    return { id: moduleId, deleted: true };
};


/**
 * Reorder modules inside a course
 *
 * The multi-document `bulkWrite` is wrapped in a MongoDB transaction (L3) so
 * that a failure during any single update aborts/rolls back the entire reorder,
 * never leaving a course with a partially-applied order.
 */
export const reorderModules = async (
    courseId,
    modules,
    user
) => {

    // Verify the course exists and the current user owns it (or is an admin).
    // Only ownership-relevant Course fields are fetched. (Auth gate — runs
    // before the transaction and only reads, so it needs no session.)
    await verifyCourseOwnership(courseId, user, "reorder modules in this course");

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const moduleIds = modules.map(
            (item) => item.moduleId
        );

        // Membership check — runs inside the transaction so its reads are
        // consistent with the update batch.
        const existingModules = await Module.find({
            _id: {
                $in: moduleIds
            },
            course: courseId,
        }).session(session);

        if (
            existingModules.length !== modules.length
        ) {
            throw new BadRequestError(
                "One or more modules do not belong to this course"
            );
        }

        const bulkOperations = modules.map(
            (item) => ({
                updateOne: {
                    filter: {
                        _id: item.moduleId,
                        course: courseId,
                    },
                    update: {
                        $set: {
                            order: item.order,
                        },
                    },
                },
            })
        );

        await Module.bulkWrite(
            bulkOperations,
            { session }
        );

        await session.commitTransaction();

        return await Module.findByCourse(
            courseId
        );
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};