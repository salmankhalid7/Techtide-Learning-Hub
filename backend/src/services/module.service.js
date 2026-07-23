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