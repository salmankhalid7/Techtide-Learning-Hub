/**
 * @file task.routes.js
 * @description Routes for LearnX AI Task management + submissions.
 */

import { Router } from "express";

import {
    // Instructor management
    createTask,
    updateTask,
    getTask,
    getModuleTasks,
    publishTask,
    archiveTask,
    deleteTask,
    reorderTasks,

    // Instructor submissions
    getTaskSubmissions,
    getSubmission,
    regradeSubmission,

    // Student access & submission
    getStudentTask,
    getMySubmission,
    getMyTaskSubmissions,
    submitTask,
} from "../controllers/task.controller.js";

import {
    createTaskValidator,
    updateTaskValidator,
    getTaskValidator,
    getModuleTasksValidator,
    publishTaskValidator,
    archiveTaskValidator,
    deleteTaskValidator,
    reorderTasksValidator,

    getTaskSubmissionsValidator,
    submissionIdValidator,
    regradeTaskValidator,

    submitTaskValidator,
} from "../validators/task.validator.js";

import validate from "../middlewares/validation.middleware.js";
import authenticate from "../middlewares/authenticate.js";
import authorize from "../middlewares/authorize.js";

const router = Router();

/* ------------------------------------------------------------------------ */
/* Instructor: management (nested under modules)                            */
/* ------------------------------------------------------------------------ */

router.post(
    "/modules/:moduleId/tasks",
    authenticate,
    authorize("instructor", "admin"),
    createTaskValidator,
    validate,
    createTask
);

router.get(
    "/modules/:moduleId/tasks",
    authenticate,
    authorize("instructor", "admin"),
    getModuleTasksValidator,
    validate,
    getModuleTasks
);

router.patch(
    "/modules/:moduleId/tasks/reorder",
    authenticate,
    authorize("instructor", "admin"),
    reorderTasksValidator,
    validate,
    reorderTasks
);

/* ------------------------------------------------------------------------ */
/* Instructor: task management by ID                                        */
/* ------------------------------------------------------------------------ */

router.get(
    "/tasks/:taskId",
    authenticate,
    authorize("instructor", "admin"),
    getTaskValidator,
    validate,
    getTask
);

router.patch(
    "/tasks/:taskId",
    authenticate,
    authorize("instructor", "admin"),
    updateTaskValidator,
    validate,
    updateTask
);

router.patch(
    "/tasks/:taskId/publish",
    authenticate,
    authorize("instructor", "admin"),
    publishTaskValidator,
    validate,
    publishTask
);

router.patch(
    "/tasks/:taskId/archive",
    authenticate,
    authorize("instructor", "admin"),
    archiveTaskValidator,
    validate,
    archiveTask
);

router.delete(
    "/tasks/:taskId",
    authenticate,
    authorize("instructor", "admin"),
    deleteTaskValidator,
    validate,
    deleteTask
);

/* ------------------------------------------------------------------------ */
/* Instructor: submissions & regrade                                        */
/* ------------------------------------------------------------------------ */

router.get(
    "/tasks/:taskId/submissions",
    authenticate,
    authorize("instructor", "admin"),
    getTaskSubmissionsValidator,
    validate,
    getTaskSubmissions
);

router.get(
    "/tasks/:taskId/submissions/:submissionId",
    authenticate,
    authorize("instructor", "admin"),
    submissionIdValidator,
    validate,
    getSubmission
);

router.patch(
    "/tasks/:taskId/submissions/:submissionId/regrade",
    authenticate,
    authorize("instructor", "admin"),
    regradeTaskValidator,
    validate,
    regradeSubmission
);

/* ------------------------------------------------------------------------ */
/* Student: access & submission                                             */
/* ------------------------------------------------------------------------ */

// NOTE: read-only param access for the student is allowed; the service
// enforces published-state + active enrollment.
router.get(
    "/tasks/:taskId/student",
    authenticate,
    authorize("student", "instructor", "admin"),
    getTaskValidator,
    validate,
    getStudentTask
);

router.get(
    "/tasks/:taskId/my-submissions",
    authenticate,
    authorize("student", "instructor", "admin"),
    getTaskSubmissionsValidator,
    validate,
    getMyTaskSubmissions
);

router.get(
    "/tasks/:taskId/my-submission",
    authenticate,
    authorize("student", "instructor", "admin"),
    getTaskValidator,
    validate,
    getMySubmission
);

router.post(
    "/tasks/:taskId/submit",
    authenticate,
    authorize("student", "instructor", "admin"),
    submitTaskValidator,
    validate,
    submitTask
);

export default router;
