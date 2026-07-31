/**
 * @file verify-question-create.mjs
 * @description Verifies the exact scenario that previously failed with E11000:
 *              creating a question with order=1 for a quiz that already has a
 *              SOFT-DELETED question with order=1.
 *
 * The insert runs inside a transaction that is ALWAYS aborted, so no data is
 * persisted.
 *
 * Usage:
 *   node scripts/verify-question-create.mjs 6a686c12a9a2d30b8da75a89
 */
import mongoose from "mongoose";
import "dotenv/config";

const QUIZ_ID = process.argv[2];
if (!QUIZ_ID) {
  console.error("Usage: node scripts/verify-question-create.mjs <quizId>");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const questions = db.collection("questions");

const session = await mongoose.connection.startSession();
try {
  session.startTransaction();

  await questions.insertOne(
    {
      quiz: new mongoose.Types.ObjectId(QUIZ_ID),
      title: "__verify_question__",
      questionText: "verification insert (never persisted)",
      type: "TRUE_FALSE",
      order: 1, // same order as the existing SOFT-DELETED question
      options: [],
      correctAnswers: [],
      marks: 1,
      difficulty: "EASY",
      deletedAt: null,
      createdBy: new mongoose.Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    { session }
  );

  console.log(
    "OK: insert with order=1 succeeded (soft-deleted question no longer blocks it)."
  );

  await session.abortTransaction();
  console.log("Transaction aborted — no data persisted.");
} catch (error) {
  await session.abortTransaction();
  console.error("FAIL:", error.message);
  process.exitCode = 1;
} finally {
  await session.endSession();
  await mongoose.disconnect();
}
