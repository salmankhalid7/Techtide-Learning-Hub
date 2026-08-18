/**
 * @file attempt.service.js
 * @description Quiz Attempt business logic — start, submit, grade attempts.
 */

import mongoose from "mongoose";

import QuizAttempt from "../models/attempt.model.js";
import Quiz, { QUIZ_STATUS } from "../models/quiz.model.js";
import Question from "../models/question.model.js";
import Enrollment from "../models/enrollment.model.js";
import Course from "../models/course.model.js";

import { ATTEMPT_STATUS, ANSWER_STATUS } from "../constants/attempt.constants.js";
import { ENROLLMENT_STATUS } from "../constants/enrollment.constants.js";
import {
    NotFoundError,
    BadRequestError,
    ForbiddenError,
    ConflictError,
} from "../errors/index.js";
import logger from "../config/logger.js";
import { buildQuestionSnapshots } from "../helpers/attemptSnapshot.helper.js";
import { gradeAttempt } from "../helpers/attemptGrading.helper.js";
import { notifyUser } from "./notification.service.js";
import { NOTIFICATION_TYPES } from "../constants/notification.constants.js";
import emailService from "./email.service.js";
import User from "../models/user.model.js";

/* -------------------------------------------------------------------------- */
/*                              Private Helpers                               */
/* -------------------------------------------------------------------------- */

/**
 * Fetch a quiz by ID, ensuring it exists, is published, and is not soft-deleted.
 *
 * @param {string} quizId
 * @returns {Promise<Object>} Lean quiz document.
 * @throws {NotFoundError}
 * @throws {BadRequestError}
 */
const _getAvailableQuiz = async (quizId) => {
    const quiz = await Quiz.findById(quizId).lean();

    if (!quiz || quiz.deletedAt) {
        throw new NotFoundError("Quiz not found.");
    }

    if (quiz.status !== QUIZ_STATUS.PUBLISHED) {
        throw new BadRequestError("Quiz is not available for attempts.");
    }

    return quiz;
};

/**
 * Verify the student is enrolled in the course, OR is the course
 * instructor / an admin (who may test quizzes without enrolling).
 *
 * @param {string} courseId
 * @param {Object} user      - The authenticated user (req.user).
 * @throws {ForbiddenError}
 */
const _verifyEnrollment = async (courseId, user) => {
    // Instructors testing their own course, and admins, bypass enrollment.
    if (user.role === "admin") {
        return;
    }

    const course = await Course.findById(courseId).select("instructor").lean();
    if (course && course.instructor.toString() === user._id.toString()) {
        return;
    }

    const enrollment = await Enrollment.findOne({
        student: user._id,
        course: courseId,
        status: ENROLLMENT_STATUS.ACTIVE,
    }).lean();

    if (!enrollment) {
        throw new ForbiddenError(
            "You must be enrolled in this course to start an attempt."
        );
    }
};

/**
 * Ensure the student has no active (IN_PROGRESS) attempt for this quiz.
 *
 * @param {string} quizId
 * @param {string} studentId
 * @throws {ConflictError}
 */
const _assertNoActiveAttempt = async (quizId, studentId) => {
    const active = await QuizAttempt.findOne({
        quiz: quizId,
        student: studentId,
        status: ATTEMPT_STATUS.IN_PROGRESS,
    }).lean();

    if (active) {
        throw new ConflictError(
            "You already have an active attempt for this quiz. " +
                "Submit or abandon it before starting a new one."
        );
    }
};

/**
 * Ensure the student has not exceeded the maximum allowed attempts.
 *
 * @param {string} quizId
 * @param {string} studentId
 * @param {number} maxAttempts
 * @throws {ForbiddenError}
 */
const _assertMaxAttemptsNotExceeded = async (
    quizId,
    studentId,
    maxAttempts
) => {
    const count = await QuizAttempt.countDocuments({
        quiz: quizId,
        student: studentId,
    });

    if (count >= maxAttempts) {
        throw new ForbiddenError(
            `You have reached the maximum of ${maxAttempts} attempt(s) for this quiz.`
        );
    }
};

/* -------------------------------------------------------------------------- */
/*                               Public Methods                               */
/* -------------------------------------------------------------------------- */

/**
 * Start a new quiz attempt for a student.
 *
 * Performs validations in order:
 *  1. Quiz exists & is published & not deleted
 *  2. Student is enrolled in the course
 *  3. No active IN_PROGRESS attempt exists
 *  4. Max attempts not exceeded
 *  5. Opens a transaction, loads questions, builds snapshots, creates the attempt
 *
 * @async
 * @param {Object}   params
 * @param {string}   params.quizId    - The quiz to attempt.
 * @param {Object}   params.user      - The authenticated user (req.user).
 * @returns {Promise<Object>}         - The created QuizAttempt as a plain object.
 */
const startAttempt = async ({ quizId, user }) => {
    const studentId = user._id;
    logger.info(`Starting attempt — quiz: ${quizId}, student: ${studentId}`);

    // ── 1. Quiz validation ────────────────────────────────────────────

    const quiz = await _getAvailableQuiz(quizId);

    // ── 2. Enrollment validation ──────────────────────────────────────

    await _verifyEnrollment(quiz.course, user);

    // ── 3. Active attempt validation ──────────────────────────────────

    await _assertNoActiveAttempt(quizId, studentId);

    // ── 4. Max attempts validation ────────────────────────────────────

    const maxAttempts = quiz.settings?.attemptsAllowed ?? 1;
    await _assertMaxAttemptsNotExceeded(quizId, studentId, maxAttempts);

    // ── 5. Transaction ────────────────────────────────────────────────

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // ── 5a. Calculate attempt number ──────────────────────────────

        const lastAttempt = await QuizAttempt.findOne(
            { quiz: quizId, student: studentId },
            null,
            { sort: { attemptNumber: -1 }, session }
        )
            .select("attemptNumber")
            .lean();

        const attemptNumber = lastAttempt ? lastAttempt.attemptNumber + 1 : 1;

        // ── 5b. Load questions from Question collection ────────────────

        const questions = await Question.find({
            quiz: quiz._id,
            deletedAt: null,
        })
            .sort({ order: 1 })
            .lean()
            .session(session);

        if (!questions.length) {
            throw new BadRequestError("This quiz has no questions.");
        }

        // ── 5c. Build immutable snapshots ─────────────────────────────

        const answers = buildQuestionSnapshots(questions);

        const totalMarks = answers.reduce(
            (sum, a) => sum + (a.snapshot.marks || 0),
            0
        );

        // ── 5d. Create attempt document ───────────────────────────────

        const [attempt] = await QuizAttempt.create(
            [
                {
                    quiz: quiz._id,
                    course: quiz.course,
                    module: quiz.module,
                    student: studentId,
                    attemptNumber,
                    status: ATTEMPT_STATUS.IN_PROGRESS,
                    startedAt: new Date(),
                    timeLimit:
                        quiz.settings?.timeLimitType === "LIMITED"
                            ? quiz.settings.timeLimit || 0
                            : 0,
                    answers,
                    totalMarks,
                    passPercentage: quiz.settings?.passingPercentage ?? 50,
                },
            ],
            { session }
        );

        // ── 5e. Commit ────────────────────────────────────────────────

        await session.commitTransaction();

        logger.info(
            `Attempt started — id: ${attempt._id}, number: ${attemptNumber}`
        );

        return attempt.toObject();
    } catch (error) {
        logger.error("Failed to start quiz attempt.", {
            quizId,
            studentId,
            error: error.message,
        });

        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

/**
 * Get a quiz attempt by ID.
 *
 * - Students can only view their own attempts.
 * - Instructors / Admins are allowed (authorization handled by middleware).
 *
 * @async
 * @param {Object} params
 * @param {string} params.attemptId
 * @param {string} params.userId
 * @param {string} params.role
 * @returns {Promise<Object>}
 */
const getAttempt = async ({ attemptId, userId, role }) => {
    logger.info(`Fetching attempt: ${attemptId}`);

    const attempt = await QuizAttempt.findById(attemptId)
        .populate("quiz", "title")
        .populate("student", "name email")
        .lean();

    if (!attempt) {
        throw new NotFoundError("Quiz attempt not found.");
    }

    // Student can only view their own attempt
    if (
        role === "student" &&
        attempt.student._id.toString() !== userId.toString()
    ) {
        throw new ForbiddenError(
            "You are not allowed to access this quiz attempt."
        );
    }

    return attempt;
};

/**
 * Check whether an attempt has exceeded its time limit.
 * Reusable by both saveAnswers() and submitAttempt().
 *
 * @param {Object} attempt - A QuizAttempt document.
 * @returns {boolean}
 */
const _hasExpired = (attempt) => {
    if (!attempt.timeLimit || attempt.timeLimit <= 0) {
        return false;
    }

    const expiresAt = new Date(
        attempt.startedAt.getTime() + attempt.timeLimit * 60 * 1000
    );

    return new Date() > expiresAt;
};

/**
 * Question types that have selectable options (require option-ID validation).
 */
const OPTION_BASED_TYPES = [
    "MCQ_SINGLE",
    "MULTIPLE_CHOICE_SINGLE",
    "MCQ_MULTIPLE",
    "MULTIPLE_CHOICE_MULTIPLE",
    "TRUE_FALSE",
    "MATCHING",
    "ORDERING",
];

/**
 * Validate that incoming selectedAnswers only contain valid option IDs
 * from the question's snapshot. Skipped for free-text question types.
 *
 * @param {Object} answer     - The existing answer sub-document (has .snapshot).
 * @param {Array}  incoming   - The incoming answer payload.
 * @throws {BadRequestError}
 */
const _validateOptionIds = (answer, incoming) => {
    if (!OPTION_BASED_TYPES.includes(answer.snapshot.questionType)) {
        return;
    }

    const validOptionIds = answer.snapshot.options.map((o) =>
        o.optionId.toString()
    );

    for (const optionId of incoming.selectedAnswers || []) {
        if (!validOptionIds.includes(optionId.toString())) {
            throw new BadRequestError(
                "One or more selected options are invalid."
            );
        }
    }
};

/**
 * Save answers for an in-progress attempt.
 *
 * - Validates ownership, status, time limit, and question integrity.
 * - Does NOT grade — only persists the student's selections.
 *
 * @async
 * @param {Object}        params
 * @param {string}        params.attemptId
 * @param {string}        params.studentId
 * @param {Array<Object>} params.answers  - [{ question, selectedAnswers, timeSpent }]
 * @returns {Promise<Object>}
 */
const saveAnswers = async ({ attemptId, studentId, answers }) => {
    logger.info(`Saving answers for attempt: ${attemptId}`);

    const attempt = await QuizAttempt.findById(attemptId);

    if (!attempt) {
        throw new NotFoundError("Quiz attempt not found.");
    }

    if (attempt.student.toString() !== studentId.toString()) {
        throw new ForbiddenError(
            "You are not allowed to modify this attempt."
        );
    }

    if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
        throw new BadRequestError(
            "This attempt can no longer be modified."
        );
    }

    // ── Time limit validation ────────────────────────────────────────

    if (_hasExpired(attempt)) {
        throw new BadRequestError("This attempt has expired.");
    }

    // ── Duplicate question validation ────────────────────────────────

    const ids = answers.map((a) => a.question.toString());

    if (new Set(ids).size !== ids.length) {
        throw new BadRequestError(
            "Duplicate question IDs are not allowed."
        );
    }

    // ── Update answers ───────────────────────────────────────────────

    for (const incoming of answers) {
        const answer = attempt.answers.find(
            (a) => a.question.toString() === incoming.question.toString()
        );

        if (!answer) {
            throw new BadRequestError("Invalid question ID.");
        }

        _validateOptionIds(answer, incoming);

        answer.selectedAnswers = incoming.selectedAnswers || [];
        answer.timeSpent = incoming.timeSpent ?? answer.timeSpent;
        answer.answeredAt = new Date();
        answer.status = ANSWER_STATUS.ANSWERED;
    }

    await attempt.save();

    logger.info(`Answers saved for attempt: ${attemptId}`);

    return attempt;
};

/**
 * Submit an in-progress attempt for grading.
 *
 * - Validates ownership, status, and time limit.
 * - Auto-grades objective questions via the grading helper.
 * - Calculates score, percentage, pass/fail, and summary.
 * - Updates the attempt status to GRADED.
 *
 * @async
 * @param {Object} params
 * @param {string} params.attemptId
 * @param {string} params.studentId
 * @returns {Promise<Object>}
 */
const submitAttempt = async ({ attemptId, studentId }) => {
    logger.info(`Submitting attempt: ${attemptId}`);

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // ── 1. Load attempt ──────────────────────────────────────────

        const attempt = await QuizAttempt.findById(attemptId).session(session);

        if (!attempt) {
            throw new NotFoundError("Quiz attempt not found.");
        }

        // ── 2. Ownership validation ──────────────────────────────────

        if (attempt.student.toString() !== studentId.toString()) {
            throw new ForbiddenError(
                "You are not allowed to submit this attempt."
            );
        }

        // ── 3. Status validation ─────────────────────────────────────

        if (attempt.status !== ATTEMPT_STATUS.IN_PROGRESS) {
            throw new BadRequestError(
                "This attempt has already been submitted."
            );
        }

        // ── 4. Time validation ───────────────────────────────────────

        if (_hasExpired(attempt)) {
            throw new BadRequestError("This attempt has expired.");
        }

        // ── 5. Grade answers ─────────────────────────────────────────

        const result = gradeAttempt(
            attempt.answers,
            attempt.totalMarks,
            attempt.passPercentage
        );

        // ── 6. Update attempt ────────────────────────────────────────

        attempt.answers = result.answers;
        attempt.obtainedMarks = result.obtainedMarks;
        attempt.percentage = result.percentage;
        attempt.passed = result.passed;
        attempt.summary = result.summary;
        attempt.status = ATTEMPT_STATUS.GRADED;
        attempt.submittedAt = new Date();

        await attempt.save({ session });

        // ── 7. Commit ────────────────────────────────────────────────

        await session.commitTransaction();

        logger.info(
            `Attempt submitted — id: ${attemptId}, score: ${result.percentage}%, passed: ${result.passed}`
        );

        // ── 8. Notify the student of their quiz result (post-commit) ──
        await notifyUser({
            recipient: attempt.student,
            type: NOTIFICATION_TYPES.QUIZ_RESULT,
            title: `Quiz result: ${result.passed ? "Passed" : "Needs improvement"}`,
            body: `You scored ${result.percentage}% on your quiz attempt.`,
            data: {
                attempt: attemptId,
                quiz: attempt.quiz || null,
                module: attempt.module || null,
                percentage: result.percentage,
                passed: result.passed,
            },
        });

        // ── Best-effort quiz result email (never break submission) ──
        try {
            const student = await User.findById(attempt.student).select("email fullName").lean();
            if (student?.email) {
                await emailService.sendQuizResult({
                    to: student.email,
                    fullName: student.fullName || "there",
                    quizName: "Quiz",
                    percentage: result.percentage,
                    passed: result.passed,
                });
            }
        } catch (e) {
            logger.warn("Quiz result email skipped.", { error: e.message });
        }

        return attempt;
    } catch (error) {
        logger.error("Failed to submit quiz attempt.", {
            attemptId,
            studentId,
            error: error.message,
        });

        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

/**
 * Get the result of a graded attempt.
 *
 * - Only returns results for GRADED attempts.
 * - Returns a curated view (no internal grading metadata).
 *
 * @async
 * @param {Object} params
 * @param {string} params.attemptId
 * @param {string} params.userId
 * @param {string} params.role
 * @returns {Promise<Object>}
 */
const getResult = async ({ attemptId, userId, role }) => {
    logger.info(`Fetching result for attempt: ${attemptId}`);

    const attempt = await QuizAttempt.findById(attemptId)
        .populate("quiz", "title")
        .lean();

    if (!attempt) {
        throw new NotFoundError("Quiz attempt not found.");
    }

    if (
        role === "student" &&
        attempt.student.toString() !== userId.toString()
    ) {
        throw new ForbiddenError(
            "You are not allowed to view this result."
        );
    }

    if (attempt.status !== ATTEMPT_STATUS.GRADED) {
        throw new BadRequestError(
            "Result is not available yet."
        );
    }

    return {
        quiz: attempt.quiz,
        attemptNumber: attempt.attemptNumber,
        submittedAt: attempt.submittedAt,
        totalMarks: attempt.totalMarks,
        obtainedMarks: attempt.obtainedMarks,
        percentage: attempt.percentage,
        passed: attempt.passed,
        summary: attempt.summary,
        answers: attempt.answers,
    };
};

/**
 * Get paginated attempt history for a quiz.
 *
 * - Students see only their own attempts.
 * - Instructors / Admins see all attempts for the quiz.
 *
 * @async
 * @param {Object} params
 * @param {string} params.quizId
 * @param {string} params.userId
 * @param {string} params.role
 * @param {Object} params.pagination  - { skip, limit }
 * @returns {Promise<{ attempts: Array, total: number }>}
 */
const getAttemptHistory = async ({
    quizId,
    userId,
    role,
    pagination,
}) => {
    logger.info(`Fetching attempt history for quiz: ${quizId}`);

    const filter = { quiz: quizId };

    if (role === "student") {
        filter.student = userId;
    }

    const [attempts, total] = await Promise.all([
        QuizAttempt.find(filter)
            .select(
                "attemptNumber status percentage passed startedAt submittedAt"
            )
            .sort({ attemptNumber: -1 })
            .skip(pagination.skip)
            .limit(pagination.limit)
            .lean(),
        QuizAttempt.countDocuments(filter),
    ]);

    return { attempts, total };
};

/* -------------------------------------------------------------------------- */
/*                                  Exports                                   */
/* -------------------------------------------------------------------------- */

export default {
    startAttempt,
    getAttempt,
    saveAnswers,
    submitAttempt,
    getResult,
    getAttemptHistory,
};
