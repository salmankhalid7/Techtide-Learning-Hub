import { Router } from "express";

import {
    createModuleController,
    getModuleController,
    getCourseModulesController,
    updateModuleController,
    publishModuleController,
    archiveModuleController,
    deleteModuleController,
    reorderModuleController,
} from "../controllers/module.controller.js";

import {
    createModuleValidator,
    updateModuleValidator,
    moduleIdValidator,
    reorderModuleValidator,
} from "../validators/module.validator.js";

import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";
import validate from "../middlewares/validation.middleware.js";


const router = Router();

/**
 * Public / Student Access
 */

// Get Module
router.get(
    "/:moduleId",
    getModuleController
);


// Get Course Modules
router.get(
    "/course/:courseId",
    getCourseModulesController
);


/**
 * Teacher/Admin Module Management
 */

// Reorder Modules (must be before /:moduleId to avoid route conflict)
router.patch(
    "/reorder",
    authenticate,
    authorize("instructor", "admin"),
    ...reorderModuleValidator,
    validate,
    reorderModuleController
);


// Create Module
router.post(
    "/",
    authenticate,
    authorize("instructor", "admin"),
    ...createModuleValidator,
    validate,
    createModuleController
);


// Update Module
router.patch(
    "/:moduleId",
    authenticate,
    authorize("instructor", "admin"),
    ...updateModuleValidator,
    validate,
    updateModuleController
);


// Publish Module
router.patch(
    "/:moduleId/publish",
    authenticate,
    authorize("instructor", "admin"),
    ...moduleIdValidator,
    validate,
    publishModuleController
);


// Archive Module
router.patch(
    "/:moduleId/archive",
    authenticate,
    authorize("instructor", "admin"),
    ...moduleIdValidator,
    validate,
    archiveModuleController
);


// Delete Module
router.delete(
    "/:moduleId",
    authenticate,
    authorize("instructor", "admin"),
    ...moduleIdValidator,
    validate,
    deleteModuleController
);


export default router;