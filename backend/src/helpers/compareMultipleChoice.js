/**
 * @file compareMultipleChoice.js
 * @description Grade a multiple-choice (MCQ_MULTIPLE) answer.
 *
 * All correct options must be selected — no extra, no missing.
 * Partial credit is not applied here (defer to a future enhancement).
 */

/**
 * @param {Array<string>} selectedAnswers - Student's selections.
 * @param {Array<*>}      correctAnswers  - The set of correct option IDs.
 * @param {number}        marks           - Maximum marks for this question.
 * @returns {{ isCorrect: boolean, marksAwarded: number }}
 */
export const compareMultipleChoice = (selectedAnswers, correctAnswers, marks) => {
    if (!selectedAnswers || selectedAnswers.length === 0) {
        return { isCorrect: false, marksAwarded: 0 };
    }

    const selected = [...selectedAnswers].map(String).sort();
    const correct = [...correctAnswers].map(String).sort();

    const isCorrect =
        selected.length === correct.length &&
        selected.every((val, i) => val === correct[i]);

    return { isCorrect, marksAwarded: isCorrect ? marks : 0 };
};
