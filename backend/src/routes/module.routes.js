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
import authenticateOptional from "../middlewares/authenticateOptional.js";
import authorize from "../middlewares/authorize.js";
import validate from "../middlewares/validation.middleware.js";


const router = Router();

/**
 * Public / Student Access
 *
 * Optional auth lets an authenticated instructor/admin see their own (and
 * admin: all) modules, while anonymous visitors only see published+public
 * content (H3). Response shape unchanged.
 */

// Get Module
router.get(
    "/:moduleId",
    authenticateOptional,
    getModuleController
);


// Get Course Modules
router.get(
    "/course/:courseId",
    authenticateOptional,
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