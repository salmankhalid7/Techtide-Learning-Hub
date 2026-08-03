/**
 * @file compareTrueFalse.js
 * @description Grade a true/false answer.
 *
 * Behaves identically to single-choice: one selection must match the answer.
 */

import { compareSingleChoice } from "./compareSingleChoice.js";

/**
 * @param {Array<string>} selectedAnswers - Student's selection (e.g. ["true"] or ["false"]).
 * @param {Array<*>}      correctAnswers  - The correct value.
 * @param {number}        marks           - Maximum marks for this question.
 * @returns {{ isCorrect: boolean, marksAwarded: number }}
 */
export const compareTrueFalse = compareSingleChoice;
