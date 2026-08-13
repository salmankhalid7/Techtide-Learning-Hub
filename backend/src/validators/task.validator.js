import { body, param, query } from "express-validator";
import {
    TASK_TYPES,
    TASK_DIFFICULTY,
    SUBMISSION_TYPES,
} from "../constants/task.constants.js";

const TASK_TYPE_VALUES = Object.values(TASK_TYPES);
const TASK_DIFFICULTY_VALUES = Object.values(TASK_DIFFICULTY);
const SUBMISSION_TYPE_VALUES = Object.values(SUBMISSION_TYPES);

const isObjectId = (v) => /^[0-9a-fA-F]{24}$/.test(v);

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

const paginationValidators = [
    query("page")
        .optional()
        .toInt()
        .isInt({ min: 1 })
        .withMessage("Page must be a positive integer."),

    query("limit")
        .optional()
        .toInt()
        .isInt({ min: 1, max: 100 })
        .withMessage("Limit must be between 1 and 100."),

    query("status")
        .optional()
        .isIn(["DRAFT", "PUBLISHED", "ARCHIVED"])
        .withMessage("Invalid task status."),
];

/* ------------------------------------------------------------------ */
/* Rubric                                                              */
/* ------------------------------------------------------------------ */

const rubricValidators = [
    body("rubric")
        .optional()
        .isArray()
        .withMessage("Rubric must be an array."),

    body("rubric.*.criterion")
        .if(body("rubric").exists())
        .trim()
        .notEmpty()
        .withMessage("Rubric criterion is required.")
        .isLength({ max: 500 })
        .withMessage("Rubric criterion must not exceed 500 characters."),

    body("rubric.*.description")
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage("Rubric description must not exceed 1000 characters."),

    body("rubric.*.maxPoints")
        .if(body("rubric").exists())
        .isNumeric()
        .withMessage("Rubric maxPoints must be a number.")
        .custom((value) => value > 0)
        .withMessage("Rubric maxPoints must be greater than 0."),

    body("rubric.*.order")
        .if(body("rubric").exists())
        .isInt({ min: 1 })
        .withMessage("Rubric order must be a positive integer."),
];

/* ------------------------------------------------------------------ */
/* Submission settings                                                 */
/* ------------------------------------------------------------------ */

const submissionSettingsValidators = [
    body("submissionSettings")
        .optional()
        .isObject()
        .withMessage("Submission settings must be an object."),

    body("submissionSettings.allowedTypes")
        .optional()
        .isArray({ min: 1 })
        .withMessage("At least one allowed submission type is required."),

    body("submissionSettings.allowedTypes.*")
        .isIn(SUBMISSION_TYPE_VALUES)
        .withMessage("Invalid submission type."),

    body("submissionSettings.attemptLimit")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Attempt limit must be at least 1."),

    body("submissionSettings.allowLateSubmission")
        .optional()
        .isBoolean()
        .withMessage("allowLateSubmission must be a boolean."),

    body("submissionSettings.maxFileSize")
        .optional()
        .isInt({ min: 1 })
        .withMessage("maxFileSize must be a positive integer."),
];

/* ------------------------------------------------------------------ */
/* Create / update task                                                */
/* ------------------------------------------------------------------ */

export const createTaskValidator = [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Task title is required.")
        .isLength({ max: 200 })
        .withMessage("Task title must not exceed 200 characters."),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Task description must not exceed 2000 characters."),

    body("instructions")
        .optional()
        .trim()
        .isLength({ max: 10000 })
        .withMessage("Task instructions must not exceed 10000 characters."),

    body("course")
        .custom(isObjectId)
        .withMessage("Valid course ID is required."),

    body("module")
        .custom(isObjectId)
        .withMessage("Valid module ID is required."),

    body("lesson")
        .optional({ nullable: true })
        .custom(isObjectId)
        .withMessage("Lesson must be a valid ID."),

    body("taskType")
        .isIn(TASK_TYPE_VALUES)
        .withMessage("Invalid task type."),

    body("difficulty")
        .optional()
        .isIn(TASK_DIFFICULTY_VALUES)
        .withMessage("Invalid task difficulty."),

    body("maxScore")
        .isNumeric()
        .withMessage("Maximum score must be a number.")
        .custom((value) => value > 0)
        .withMessage("Maximum score must be greater than 0."),

    body("passingScore")
        .isNumeric()
        .withMessage("Passing score must be a number.")
        .custom((value) => value > 0)
        .withMessage("Passing score must be greater than 0."),

    body("dueDate")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("Due date must be a valid date."),

    body("order")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Task order must be a positive integer."),

    ...rubricValidators,
    ...submissionSettingsValidators,
];

export const updateTaskValidator = [
    param("taskId")
        .custom(isObjectId)
        .withMessage("Valid task ID is required."),

    body("title")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Task title must not be empty.")
        .isLength({ max: 200 })
        .withMessage("Task title must not exceed 200 characters."),

    body("description")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Task description must not exceed 2000 characters."),

    body("instructions")
        .optional()
        .trim()
        .isLength({ max: 10000 })
        .withMessage("Task instructions must not exceed 10000 characters."),

    body("taskType")
        .optional()
        .isIn(TASK_TYPE_VALUES)
        .withMessage("Invalid task type."),

    body("difficulty")
        .optional()
        .isIn(TASK_DIFFICULTY_VALUES)
        .withMessage("Invalid task difficulty."),

    body("maxScore")
        .optional()
        .isNumeric()
        .withMessage("Maximum score must be a number.")
        .custom((value) => value > 0)
        .withMessage("Maximum score must be greater than 0."),

    body("passingScore")
        .optional()
        .isNumeric()
        .withMessage("Passing score must be a number.")
        .custom((value) => value > 0)
        .withMessage("Passing score must be greater than 0."),

    body("dueDate")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("Due date must be a valid date."),

    body("order")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Task order must be a positive integer."),

    ...rubricValidators,
    ...submissionSettingsValidators,
];

/* ------------------------------------------------------------------ */
/* ID-only params                                                      */
/* ------------------------------------------------------------------ */

const taskIdParam = [
    param("taskId")
        .custom(isObjectId)
        .withMessage("Valid task ID is required."),
];

export const taskIdValidator = taskIdParam;
export const getTaskValidator = taskIdParam;
export const publishTaskValidator = taskIdParam;
export const archiveTaskValidator = taskIdParam;
export const deleteTaskValidator = taskIdParam;

export const getTaskSubmissionsValidator = [
    ...taskIdParam,
    ...paginationValidators,
];

export const getModuleTasksValidator = [
    param("moduleId")
        .custom(isObjectId)
        .withMessage("Valid module ID is required."),
    ...paginationValidators,
];

/* ------------------------------------------------------------------ */
/* Student submission                                                  */
/* ------------------------------------------------------------------ */

export const submitTaskValidator = [
    param("taskId")
        .custom(isObjectId)
        .withMessage("Valid task ID is required."),

    body("content")
        .optional()
        .isObject()
        .withMessage("Submission content must be an object."),

    body("content.textContent")
        .optional()
        .trim()
        .isLength({ max: 20000 })
        .withMessage("Text submission must not exceed 20000 characters."),

    body("content.codeContent")
        .optional()
        .trim()
        .isLength({ max: 50000 })
        .withMessage("Code submission must not exceed 50000 characters."),

    body("content.codeLanguage")
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage("Code language must not exceed 50 characters."),

    body("content.url")
        .optional()
        .trim()
        .isURL()
        .withMessage("URL submission must be a valid URL."),

    body("content.attachments")
        .optional()
        .isArray()
        .withMessage("Attachments must be an array."),

    body("content.attachments.*.name")
        .optional()
        .trim()
        .isLength({ max: 255 })
        .withMessage("Attachment name must not exceed 255 characters."),

    body("content.attachments.*.url")
        .optional()
        .trim()
        .isURL()
        .withMessage("Attachment URL must be a valid URL."),

    body("content.attachments.*.publicId")
        .optional()
        .trim(),

    body("content.attachments.*.mimeType")
        .optional()
        .trim(),
];

/* ------------------------------------------------------------------ */
/* Instructor regrade                                                  */
/* ------------------------------------------------------------------ */

export const regradeTaskValidator = [
    param("taskId")
        .custom(isObjectId)
        .withMessage("Valid task ID is required."),

    param("submissionId")
        .custom(isObjectId)
        .withMessage("Valid submission ID is required."),

    body("score")
        .exists()
        .withMessage("Score is required for regrade.")
        .isNumeric()
        .withMessage("Score must be a number.")
        .custom((value) => value >= 0)
        .withMessage("Score must be greater than or equal to 0."),

    body("feedback")
        .optional()
        .trim()
        .isLength({ max: 5000 })
        .withMessage("Regrade feedback must not exceed 5000 characters."),

    body("comment")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Regrade comment must not exceed 2000 characters."),
];

/* ------------------------------------------------------------------ */
/* Get a single submission (params only)                               */
/* ------------------------------------------------------------------ */

export const submissionIdValidator = [
    param("taskId")
        .custom(isObjectId)
        .withMessage("Valid task ID is required."),

    param("submissionId")
        .custom(isObjectId)
        .withMessage("Valid submission ID is required."),
];

/* ------------------------------------------------------------------ */
/* Reorder                                                             */
/* ------------------------------------------------------------------ */

export const reorderTasksValidator = [
    param("moduleId")
        .custom(isObjectId)
        .withMessage("Valid module ID is required."),

    body("tasks")
        .exists()
        .withMessage("tasks array is required.")
        .isArray({ min: 1 })
        .withMessage("tasks must be a non-empty array."),

    body("tasks.*.taskId")
        .custom(isObjectId)
        .withMessage("Valid task ID required in reorder payload."),

    body("tasks.*.order")
        .isInt({ min: 1 })
        .withMessage("Task order must be a positive integer."),
];