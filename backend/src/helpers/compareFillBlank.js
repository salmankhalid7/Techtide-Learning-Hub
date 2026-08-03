/**
 * @file compareFillBlank.js
 * @description Grade a fill-in-the-blank answer.
 *
 * Performs a case-insensitive trim comparison against the set of
 * acceptable answers stored in the snapshot.
 */

/**
 * @param {Array<string>} selectedAnswers - Student's text input (should be [string]).
 * @param {Array<*>}      correctAnswers  - Acceptable answer strings.
 * @param {number}        marks           - Maximum marks for this question.
 * @returns {{ isCorrect: boolean, marksAwarded: number }}
 */
export const compareFillBlank = (selectedAnswers, correctAnswers, marks) => {
    if (!selectedAnswers || selectedAnswers.length === 0) {
        return { isCorrect: false, marksAwarded: 0 };
    }

    const studentAnswer = String(selectedAnswers[0] || "").trim().toLowerCase();
    const acceptable = correctAnswers.map((a) => String(a).trim().toLowerCase());

    const isCorrect = acceptable.includes(studentAnswer);

    return { isCorrect, marksAwarded: isCorrect ? marks : 0 };
};
