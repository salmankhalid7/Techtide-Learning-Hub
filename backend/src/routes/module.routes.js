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

import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";
import validate from "../middlewares/validation.middleware.js";


const router = Router();


/**
 * Teacher/Admin Module Management
 */

// Create Module
router.post(
    "/",
    authenticate,
    authorize("teacher", "admin"),
    createModuleValidator,
    validate,
    createModuleController
);


// Update Module
router.patch(
    "/:moduleId",
    authenticate,
    authorize("teacher", "admin"),
    updateModuleValidator,
    validate,
    updateModuleController
);


// Publish Module
router.patch(
    "/:moduleId/publish",
    authenticate,
    authorize("teacher", "admin"),
    moduleIdValidator,
    validate,
    publishModuleController
);


// Archive Module
router.patch(
    "/:moduleId/archive",
    authenticate,
    authorize("teacher", "admin"),
    moduleIdValidator,
    validate,
    archiveModuleController
);


// Delete Module
router.delete(
    "/:moduleId",
    authenticate,
    authorize("teacher", "admin"),
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