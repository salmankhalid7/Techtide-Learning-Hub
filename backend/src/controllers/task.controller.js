/**
 * @file task.controller.js
 * @description Controller for LearnX AI Task management + submission APIs.
 */

import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";

import {
    createTask as createTaskService,
    updateTask as updateTaskService,
    getTask as getTaskService,
    getModuleTasks as getModuleTasksService,
    publishTask as publishTaskService,
    archiveTask as archiveTaskService,
    deleteTask as deleteTaskService,
    reorderTasks as reorderTasksService,

    getStudentTask as getStudentTaskService,
    getMySubmission as getMySubmissionService,
    getMyTaskSubmissions as getMyTaskSubmissionsService,
    submitTask as submitTaskService,

    getTaskSubmissions as getTaskSubmissionsService,
    getSubmission as getSubmissionService,
    regradeSubmission as regradeSubmissionService,
} from "../services/task.service.js";

/* ------------------------------------------------------------------------ */
/* Instructor: management                                                    */
/* ------------------------------------------------------------------------ */

/** @desc Create a task in a module */
const createTask = asyncHandler(async (req, res) => {
    const task = await createTaskService({
        moduleId: req.params.moduleId,
        user: req.user,
        data: req.body,
    });
    return res.status(201).json(new ApiResponse(201, "Task created successfully.", task));
});

/** @desc Update a task */
const updateTask = asyncHandler(async (req, res) => {
    const task = await updateTaskService({
        taskId: req.params.taskId,
        user: req.user,
        data: req.body,
    });
    return res.status(200).json(new ApiResponse(200, "Task updated successfully.", task));
});

/** @desc Get a task by ID (instructor) */
const getTask = asyncHandler(async (req, res) => {
    const task = await getTaskService({
        taskId: req.params.taskId,
        user: req.user,
    });
    return res.status(200).json(new ApiResponse(200, "Task fetched successfully.", task));
});

/** @desc List tasks for a module */
const getModuleTasks = asyncHandler(async (req, res) => {
    const data = await getModuleTasksService({
        moduleId: req.params.moduleId,
        user: req.user,
        query: req.query,
    });
    return res.status(200).json(new ApiResponse(200, "Tasks fetched successfully.", data));
});

/** @desc Publish a task */
const publishTask = asyncHandler(async (req, res) => {
    const task = await publishTaskService({
        taskId: req.params.taskId,
        user: req.user,
    });
    return res.status(200).json(new ApiResponse(200, "Task published successfully.", task));
});

/** @desc Archive a task */
const archiveTask = asyncHandler(async (req, res) => {
    const task = await archiveTaskService({
        taskId: req.params.taskId,
        user: req.user,
    });
    return res.status(200).json(new ApiResponse(200, "Task archived successfully.", task));
});

/** @desc Soft delete a task */
const deleteTask = asyncHandler(async (req, res) => {
    await deleteTaskService({
        taskId: req.params.taskId,
        user: req.user,
    });
    return res.status(200).json(new ApiResponse(200, "Task deleted successfully."));
});

/** @desc Reorder tasks within a module */
const reorderTasks = asyncHandler(async (req, res) => {
    const tasks = await reorderTasksService({
        moduleId: req.params.moduleId,
        user: req.user,
        tasks: req.body.tasks,
    });
    return res.status(200).json(new ApiResponse(200, "Tasks reordered successfully.", tasks));
});

/* ------------------------------------------------------------------------ */
/* Instructor: submissions                                                   */
/* ------------------------------------------------------------------------ */

/** @desc List all submissions for a task */
const getTaskSubmissions = asyncHandler(async (req, res) => {
    const data = await getTaskSubmissionsService({
        taskId: req.params.taskId,
        user: req.user,
        query: req.query,
    });
    return res.status(200).json(new ApiResponse(200, "Submissions fetched successfully.", data));
});

/** @desc Get a single submission */
const getSubmission = asyncHandler(async (req, res) => {
    const submission = await getSubmissionService({
        taskId: req.params.taskId,
        submissionId: req.params.submissionId,
        user: req.user,
    });
    return res.status(200).json(new ApiResponse(200, "Submission fetched successfully.", submission));
});

/** @desc Instructor regrades / overrides a submission */
const regradeSubmission = asyncHandler(async (req, res) => {
    const submission = await regradeSubmissionService({
        taskId: req.params.taskId,
        submissionId: req.params.submissionId,
        user: req.user,
        data: req.body,
    });
    return res.status(200).json(new ApiResponse(200, "Submission regraded successfully.", submission));
});

/* ------------------------------------------------------------------------ */
/* Student: access & submission                                              */
/* ------------------------------------------------------------------------ */

/** @desc Get a published task for an enrolled student */
const getStudentTask = asyncHandler(async (req, res) => {
    const task = await getStudentTaskService({
        taskId: req.params.taskId,
        user: req.user,
    });
    return res.status(200).json(new ApiResponse(200, "Task fetched successfully.", task));
});

/** @desc Get the student's latest submission for a task */
const getMySubmission = asyncHandler(async (req, res) => {
    const submission = await getMySubmissionService({
        taskId: req.params.taskId,
        user: req.user,
    });
    return res.status(200).json(new ApiResponse(200, "Submission fetched successfully.", submission));
});

/** @desc Get the student's submission history for a task */
const getMyTaskSubmissions = asyncHandler(async (req, res) => {
    const data = await getMyTaskSubmissionsService({
        taskId: req.params.taskId,
        user: req.user,
        query: req.query,
    });
    return res.status(200).json(new ApiResponse(200, "Submissions fetched successfully.", data));
});

/** @desc Submit a task (draft or final, triggers AI evaluation) */
const submitTask = asyncHandler(async (req, res) => {
    const submission = await submitTaskService({
        taskId: req.params.taskId,
        user: req.user,
        data: req.body,
    });
    return res.status(201).json(new ApiResponse(201, "Task submitted successfully.", submission));
});

export {
    createTask,
    updateTask,
    getTask,
    getModuleTasks,
    publishTask,
    archiveTask,
    deleteTask,
    reorderTasks,
    getTaskSubmissions,
    getSubmission,
    regradeSubmission,
    getStudentTask,
    getMySubmission,
    getMyTaskSubmissions,
    submitTask,
};
