/**
 * @file compareSingleChoice.js
 * @description Grade a single-choice (MCQ_SINGLE) answer.
 *
 * The student's single selection must match the one correct answer exactly.
 */

/**
 * @param {Array<string>} selectedAnswers - Student's selections (should be [optionId]).
 * @param {Array<*>}      correctAnswers  - The single correct option ID.
 * @param {number}        marks           - Maximum marks for this question.
 * @returns {{ isCorrect: boolean, marksAwarded: number }}
 */
export const compareSingleChoice = (selectedAnswers, correctAnswers, marks) => {
    if (!selectedAnswers || selectedAnswers.length === 0) {
        return { isCorrect: false, marksAwarded: 0 };
    }

    const isCorrect =
        selectedAnswers[0].toString() === correctAnswers[0]?.toString();

    return { isCorrect, marksAwarded: isCorrect ? marks : 0 };
};
