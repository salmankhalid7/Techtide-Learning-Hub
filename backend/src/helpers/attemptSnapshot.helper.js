/**
 * @file attemptSnapshot.helper.js
 * @description Builds immutable question snapshots for quiz attempts.
 *
 * Captures question state at attempt-start time so that later edits
 * to the quiz do not affect historical attempts.
 */

/**
 * Build an answers array (with snapshots) from Question documents.
 *
 * Each entry contains:
 *  - question:   the original Question ObjectId
 *  - snapshot:   frozen copy of the question at the time of the attempt
 *  - selectedAnswers: empty array (populated as the student answers)
 *
 * @param {Array<Object>} questions - Array of lean Question documents.
 * @returns {Array<Object>}         - Answers array ready to embed in a QuizAttempt.
 */
export const buildQuestionSnapshots = (questions) =>
    questions.map((question) => ({
        question: question._id,

        snapshot: {
            questionId: question._id,
            questionText: question.questionText,
            questionType: question.type,
            options: (question.options || []).map((option) => ({
                optionId: option.id,
                text: option.text,
            })),
            correctAnswers: question.correctAnswers || [],
            marks: question.marks,
            order: question.order,
        },

        selectedAnswers: [],
    }));
