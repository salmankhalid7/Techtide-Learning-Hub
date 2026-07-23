import Module from "../models/module.model.js";
import Course from "../models/course.model.js";

import ApiError from "../utils/ApiError.js";


/**
 * Create a new module inside a course
 */
export const createModule = async (moduleData) => {

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
        throw new ApiError(
            404,
            "Course not found"
        );
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
        throw new ApiError(
            404,
            "Module not found"
        );
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
    updateData
) => {

    const module = await Module.findById(moduleId);

    if (!module) {
        throw new ApiError(
            404,
            "Module not found"
        );
    }


    Object.assign(
        module,
        updateData
    );


    await module.save();


    return module;
};



/**
 * Publish module
 */
export const publishModule = async (moduleId) => {

    const module = await Module.findById(moduleId);

    if (!module) {
        throw new ApiError(
            404,
            "Module not found"
        );
    }


    module.status = "published";


    await module.save();


    return module;
};



/**
 * Archive module
 */
export const archiveModule = async (moduleId) => {

    const module = await Module.findById(moduleId);

    if (!module) {
        throw new ApiError(
            404,
            "Module not found"
        );
    }


    module.status = "archived";


    await module.save();


    return module;
};



/**
 * Soft delete module
 */
export const deleteModule = async (moduleId) => {

    const module = await Module.findById(moduleId);

    if (!module) {
        throw new ApiError(
            404,
            "Module not found"
        );
    }


    module.deletedAt = new Date();


    await module.save();


    return true;
};