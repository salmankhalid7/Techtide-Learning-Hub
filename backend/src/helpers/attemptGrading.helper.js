/**
 * @file attemptGrading.helper.js
 * @description Auto-grade quiz attempt answers.
 *
 * Dispatches to type-specific comparison helpers for objective questions.
 * Subjective questions (SHORT_ANSWER, LONG_ANSWER) are skipped — they
 * require manual or AI review.
 */

import { GRADING_METHOD, AUTO_GRADABLE_QUESTION_TYPES } from "../constants/attempt.constants.js";
import { compareSingleChoice } from "./compareSingleChoice.js";
import { compareMultipleChoice } from "./compareMultipleChoice.js";
import { compareTrueFalse } from "./compareTrueFalse.js";
import { compareFillBlank } from "./compareFillBlank.js";

/**
 * Map question type → comparison function.
 */
const GRADERS = {
    MCQ_SINGLE: compareSingleChoice,
    MULTIPLE_CHOICE_SINGLE: compareSingleChoice,
    MCQ_MULTIPLE: compareMultipleChoice,
    MULTIPLE_CHOICE_MULTIPLE: compareMultipleChoice,
    TRUE_FALSE: compareTrueFalse,
    FILL_IN_THE_BLANK: compareFillBlank,
};

/**
 * Auto-grade every answer in an attempt.
 *
 * - Objective questions are compared against their snapshot's correctAnswers.
 * - Subjective questions are left untouched (isCorrect stays null).
 * - Returns graded answers, scores, and a summary.
 *
 * @param {Array<Object>} answers       - The attempt's answers array.
 * @param {number}        totalMarks    - Sum of all question marks.
 * @param {number}        passPercentage - Pass threshold (0–100).
 * @returns {{ answers: Array, obtainedMarks: number, percentage: number, passed: boolean, summary: Object }}
 */
export const gradeAttempt = (answers, totalMarks, passPercentage) => {
    let obtainedMarks = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    let objectiveCount = 0;
    let subjectiveCount = 0;

    const graded = answers.map((answer) => {
        const type = answer.snapshot?.questionType;
        const marks = answer.snapshot?.marks || 0;

        // Track question type counts
        if (AUTO_GRADABLE_QUESTION_TYPES.includes(type)) {
            objectiveCount++;
        } else {
            subjectiveCount++;
            // Subjective — leave as-is
            return answer;
        }

        // Determine if the student answered
        const hasAnswer =
            answer.selectedAnswers && answer.selectedAnswers.length > 0;

        if (!hasAnswer) {
            unansweredCount++;
            return {
                ...answer,
                isCorrect: false,
                marksAwarded: 0,
                status: "UNANSWERED",
                evaluation: {
                    method: GRADING_METHOD.AUTO,
                    confidence: 1,
                    reviewedAt: new Date(),
                },
            };
        }

        // Dispatch to the correct grader
        const grader = GRADERS[type];

        if (!grader) {
            // Unknown type — skip
            return answer;
        }

        const { isCorrect, marksAwarded } = grader(
            answer.selectedAnswers,
            answer.snapshot.correctAnswers || [],
            marks
        );

        obtainedMarks += marksAwarded;

        if (isCorrect) {
            correctCount++;
        } else {
            incorrectCount++;
        }

        return {
            ...answer,
            isCorrect,
            marksAwarded,
            status: "ANSWERED",
            evaluation: {
                method: GRADING_METHOD.AUTO,
                confidence: 1,
                reviewedAt: new Date(),
            },
        };
    });

    const percentage =
        totalMarks > 0
            ? Math.round((obtainedMarks / totalMarks) * 100 * 100) / 100
            : 0;

    const passed = percentage >= passPercentage;

    const summary = {
        totalQuestions: answers.length,
        correctAnswers: correctCount,
        incorrectAnswers: incorrectCount,
        unansweredQuestions: unansweredCount,
        objectiveQuestions: objectiveCount,
        subjectiveQuestions: subjectiveCount,
    };

    return {
        answers: graded,
        obtainedMarks,
        percentage,
        passed,
        summary,
    };
};
