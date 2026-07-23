import Module from "../models/module.model.js";
import Course from "../models/course.model.js";
import { NotFoundError, BadRequestError, ForbiddenError } from "../errors/index.js";


/**
 * Create a new module inside a course
 */
export const createModule = async (moduleData, user) => {

    const {
        course,
        title,
        description,
        order,
        estimatedDuration,
        isPreview,
    } = moduleData;


    const existingCourse = await Course.findById(course);

    if (!existingCourse) {
        throw new NotFoundError("Course not found");
    }

    if (
        user.role !== "admin" &&
        existingCourse.instructor.toString() !== user._id.toString()
    ) {
        throw new ForbiddenError("You are not authorized to create modules in this course");
    }

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


    return module;
};

/**
 * Get module by ID
 */
export const getModuleById = async (moduleId) => {

    const module = await Module.findById(moduleId)
        .populate("course", "title slug");

    if (!module) {
        throw new NotFoundError("Module not found");
    }

    return module;
};



/**
 * Get all modules of a course
 */
export const getModulesByCourse = async (courseId) => {

    const modules = await Module.findByCourse(courseId);

    return modules;
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

    const course = await Course.findById(module.course);

    if (
        user.role !== "admin" &&
        course.instructor.toString() !== user._id.toString()
    ) {
        throw new ForbiddenError("You are not authorized to update this module");
    }

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

    const course = await Course.findById(module.course);

    if (
        user.role !== "admin" &&
        course.instructor.toString() !== user._id.toString()
    ) {
        throw new ForbiddenError("You are not authorized to publish this module");
    }

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

    const course = await Course.findById(module.course);

    if (
        user.role !== "admin" &&
        course.instructor.toString() !== user._id.toString()
    ) {
        throw new ForbiddenError("You are not authorized to archive this module");
    }

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

    const course = await Course.findById(module.course);

    if (
        user.role !== "admin" &&
        course.instructor.toString() !== user._id.toString()
    ) {
        throw new ForbiddenError("You are not authorized to delete this module");
    }

    module.deletedAt = new Date();


    await module.save();


    return { id: moduleId, deleted: true };
};


/**
 * Reorder modules inside a course
 */
export const reorderModules = async (
    courseId,
    modules,
    user
) => {

    const existingCourse = await Course.findById(courseId);

    if (!existingCourse) {
        throw new NotFoundError("Course not found");
    }

    if (
        user.role !== "admin" &&
        existingCourse.instructor.toString() !== user._id.toString()
    ) {
        throw new ForbiddenError("You are not authorized to reorder modules in this course");
    }

    const moduleIds = modules.map(
        (item) => item.moduleId
    );

    const existingModules = await Module.find({
        _id: {
            $in: moduleIds
        },
        course: courseId,
    });

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
        bulkOperations
    );

    return await Module.findByCourse(
        courseId
    );
};