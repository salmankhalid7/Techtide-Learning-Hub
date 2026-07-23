import { Router } from "express";

import {
    createModuleController,
    getModuleController,
    getCourseModulesController,
    updateModuleController,
    publishModuleController,
    archiveModuleController,
    deleteModuleController,
} from "../controllers/module.controller.js";

import {
    createModuleValidator,
    updateModuleValidator,
    moduleIdValidator,
} from "../validators/module.validator.js";

import { validate } from "../middlewares/validate.middleware.js";

import {
    authenticate,
} from "../middlewares/auth.middleware.js";

import {
    authorizeRoles,
} from "../middlewares/rbac.middleware.js";


const router = Router();


/**
 * Teacher/Admin Module Management
 */

// Create Module
router.post(
    "/",
    authenticate,
    authorizeRoles("teacher", "admin"),
    createModuleValidator,
    validate,
    createModuleController
);


// Update Module
router.patch(
    "/:moduleId",
    authenticate,
    authorizeRoles("teacher", "admin"),
    updateModuleValidator,
    validate,
    updateModuleController
);


// Publish Module
router.patch(
    "/:moduleId/publish",
    authenticate,
    authorizeRoles("teacher", "admin"),
    moduleIdValidator,
    validate,
    publishModuleController
);


// Archive Module
router.patch(
    "/:moduleId/archive",
    authenticate,
    authorizeRoles("teacher", "admin"),
    moduleIdValidator,
    validate,
    archiveModuleController
);


// Delete Module
router.delete(
    "/:moduleId",
    authenticate,
    authorizeRoles("teacher", "admin"),
    moduleIdValidator,
    validate,
    deleteModuleController
);



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


export default router;