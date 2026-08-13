import { body, param } from "express-validator";
import {
    TASK_TYPES,
    TASK_DIFFICULTY,
    SUBMISSION_TYPES,
} from "../constants/task.constants.js";
import { objectIdRule } from "./rules/objectId.rule.js";

export const createTaskValidator = [
    body("title")
        .trim()
        .notEmpty()
        .withMessage("Task title is required.")
        .isLength({ max: 150 })
        .withMessage("Task title must not exceed 150 characters."),

    body("description")
        .trim()
        .notEmpty()
        .withMessage("Task description is required.")
        .isLength({ max: 5000 })
        .withMessage("Task description must not exceed 5000 characters."),

    body("course")
        .custom(objectIdRule)
        .withMessage("Valid course ID is required."),

    body("module")
        .custom(objectIdRule)
        .withMessage("Valid module ID is required."),

    body("lesson")
        .optional({ nullable: true })
        .custom(objectIdRule)
        .withMessage("Lesson must be a valid ID."),

    body("taskType")
        .isIn(Object.values(TASK_TYPES))
        .withMessage("Invalid task type."),

    body("difficulty")
        .optional()
        .isIn(Object.values(TASK_DIFFICULTY))
        .withMessage("Invalid task difficulty."),

    body("maximumScore")
        .isNumeric()
        .withMessage("Maximum score must be a number.")
        .custom((value) => value > 0)
        .withMessage("Maximum score must be greater than 0."),

    body("passingScore")
        .isNumeric()
        .withMessage("Passing score must be a number.")
        .custom((value, { req }) => {
            return (
                Number(value) > 0 &&
                Number(value) <= Number(req.body.maximumScore)
            );
        })
        .withMessage(
            "Passing score must be greater than 0 and cannot exceed maximum score."
        ),

    body("allowedSubmissionType")
        .isArray({ min: 1 })
        .withMessage("At least one submission type is required."),

    body("allowedSubmissionType.*")
        .isIn(Object.values(SUBMISSION_TYPES))
        .withMessage("Invalid submission type."),

    body("dueDate")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("Due date must be a valid date."),

    body("attemptLimit")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Attempt limit must be at least 1."),

    body("rubric")
        .optional()
        .isArray()
        .withMessage("Rubric must be an array."),

    body("rubric.*.criterion")
        .if(body("rubric").exists())
        .trim()
        .notEmpty()
        .withMessage("Rubric criterion is required."),

    body("rubric.*.weight")
        .if(body("rubric").exists())
        .isNumeric()
        .withMessage("Rubric weight must be a number.")
        .custom((value) => value > 0)
        .withMessage("Rubric weight must be greater than 0.")
];

export const updateTaskValidator = [
    param("taskId")
        .custom(objectIdRule)
        .withMessage("Valid task ID is required."),

    body("title")
        .optional()
        .trim()
        .notEmpty()
        .isLength({ max: 150 })
        .withMessage("Task title must not exceed 150 characters."),

    body("description")
        .optional()
        .trim()
        .notEmpty()
        .isLength({ max: 5000 })
        .withMessage("Task description must not exceed 5000 characters."),

    body("taskType")
        .optional()
        .isIn(Object.values(TASK_TYPES))
        .withMessage("Invalid task type."),

    body("difficulty")
        .optional()
        .isIn(Object.values(TASK_DIFFICULTY))
        .withMessage("Invalid task difficulty."),

    body("maximumScore")
        .optional()
        .isNumeric()
        .withMessage("Maximum score must be a number.")
        .custom((value) => value > 0)
        .withMessage("Maximum score must be greater than 0."),

    body("passingScore")
        .optional()
        .isNumeric()
        .withMessage("Passing score must be greater than 0."),

    body("allowedSubmissionType")
        .optional()
        .isArray({ min: 1 })
        .withMessage("At least one submission type is required."),

    body("allowedSubmissionType.*")
        .isIn(Object.values(SUBMISSION_TYPES))
        .withMessage("Invalid submission type."),

    body("dueDate")
        .optional({ nullable: true })
        .isISO8601()
        .withMessage("Due date must be a valid date."),

    body("attemptLimit")
        .optional()
        .isInt({ min: 1 })
        .withMessage("Attempt limit must be at least 1."),

    body("rubric")
        .optional()
        .isArray()
        .withMessage("Rubric must be an array.")
];

export const taskIdValidator = [
    param("taskId")
        .custom(objectIdRule)
        .withMessage("Valid task ID is required.")
];

export const publishTaskValidator = taskIdValidator;
export const archiveTaskValidator = taskIdValidator;
export const deleteTaskValidator = taskIdValidator;