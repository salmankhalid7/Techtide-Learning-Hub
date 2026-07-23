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
 *
 * All routes below require authentication.
 */
router.use(authenticate);

// Reorder Modules (must be before /:moduleId to avoid route conflict)
router.patch(
    "/reorder",
    authorize("instructor", "admin"),
    ...reorderModuleValidator,
    validate,
    reorderModuleController
);


// Create Module
router.post(
    "/",
    authorize("instructor", "admin"),
    ...createModuleValidator,
    validate,
    createModuleController
);


// Update Module
router.patch(
    "/:moduleId",
    authorize("instructor", "admin"),
    ...updateModuleValidator,
    validate,
    updateModuleController
);


// Publish Module
router.patch(
    "/:moduleId/publish",
    authorize("instructor", "admin"),
    ...moduleIdValidator,
    validate,
    publishModuleController
);


// Archive Module
router.patch(
    "/:moduleId/archive",
    authorize("instructor", "admin"),
    ...moduleIdValidator,
    validate,
    archiveModuleController
);


// Delete Module
router.delete(
    "/:moduleId",
    authorize("instructor", "admin"),
    ...moduleIdValidator,
    validate,
    deleteModuleController
);


export default router;