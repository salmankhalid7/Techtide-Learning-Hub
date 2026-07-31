/**
 * @file verify-reorder.mjs
 * @description Integration test for reorderQuestions against the real DB.
 *
 * - TEST 1: partial payload (2 of 3 questions) → must be rejected with a
 *   BadRequestError instead of an E11000 duplicate-key crash.
 * - TEST 2: full no-op reorder (same orders) → must succeed.
 * - TEST 3: full swap reorder (1 ↔ 3) then restore → must succeed, proving
 *   the two-phase write avoids transient unique-index collisions.
 *
 * All writes restore the original ordering, so the data is left unchanged.
 *
 * Usage:
 *   node scripts/verify-reorder.mjs <quizId>
 */
import "dotenv/config";
import mongoose from "mongoose";
import { reorderQuestions } from "../src/services/question.service.js";

const QUIZ_ID = process.argv[2];
if (!QUIZ_ID) {
  console.error("Usage: node scripts/verify-reorder.mjs <quizId>");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

// Any admin passes verifyCourseOwnership.
const admin = { _id: new mongoose.Types.ObjectId(), role: "admin" };

const loadActive = async () =>
  mongoose.connection.db
    .collection("questions")
    .find({ quiz: new mongoose.Types.ObjectId(QUIZ_ID), deletedAt: null })
    .project({ _id: 1, order: 1 })
    .sort({ order: 1 })
    .toArray();

const current = await loadActive();
console.log(
  "Active questions:",
  current.map((q) => `${q.order}:${q._id}`).join(", ")
);

let failures = 0;

// ── TEST 1: partial payload must be rejected ────────────────────────────
const partial = current.slice(0, 2).map((q) => ({
  questionId: q._id.toString(),
  order: q.order,
}));
try {
  await reorderQuestions({ quizId: QUIZ_ID, user: admin, questions: partial });
  console.log("TEST 1 FAIL: partial reorder unexpectedly succeeded.");
  failures++;
} catch (err) {
  const ok = err.name === "BadRequestError" || err.statusCode === 400;
  console.log(
    `TEST 1 ${ok ? "PASS" : "FAIL"}: partial reorder rejected with "${err.message}"`
  );
  if (!ok) failures++;
}

// ── TEST 2: full no-op reorder ──────────────────────────────────────────
const full = current.map((q) => ({ questionId: q._id.toString(), order: q.order }));
try {
  await reorderQuestions({ quizId: QUIZ_ID, user: admin, questions: full });
  console.log("TEST 2 PASS: full no-op reorder succeeded.");
} catch (err) {
  console.log(`TEST 2 FAIL: ${err.message}`);
  failures++;
}

// ── TEST 3: full swap (1 ↔ 3) then restore ──────────────────────────────
const swapped = current.map((q) => {
  const order = q.order === 1 ? 3 : q.order === 3 ? 1 : q.order;
  return { questionId: q._id.toString(), order };
});
try {
  await reorderQuestions({ quizId: QUIZ_ID, user: admin, questions: swapped });
  await reorderQuestions({ quizId: QUIZ_ID, user: admin, questions: full });
  console.log("TEST 3 PASS: full swap reorder succeeded and was restored.");
} catch (err) {
  console.log(`TEST 3 FAIL: ${err.message}`);
  failures++;
}

// ── Final state must match original ─────────────────────────────────────
const after = await loadActive();
const original = current.map((q) => `${q.order}:${q._id}`).join(", ");
const finalState = after.map((q) => `${q.order}:${q._id}`).join(", ");
console.log("Final state:  ", finalState);
if (original !== finalState) {
  console.log("STATE MISMATCH — data was left changed!");
  failures++;
} else {
  console.log("State unchanged from original.");
}

await mongoose.disconnect();
console.log(failures ? `\n${failures} test(s) failed.` : "\nAll tests passed.");
process.exitCode = failures ? 1 : 0;
