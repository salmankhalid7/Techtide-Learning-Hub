/**
 * @file fix-question-index.mjs
 * @description Fixes the stale `quiz_1_order_1` unique index on the questions
 *              collection.
 *
 * Problem:
 *   The DB currently has a FULL unique index on { quiz: 1, order: 1 } (no
 *   partial filter), so soft-deleted questions still occupy an index slot and
 *   block creating a new question with the same order (E11000).
 *
 * Fix:
 *   1. Pre-check: abort if any ACTIVE (deletedAt: null) question has a
 *      duplicate (quiz, order) — data must be cleaned first.
 *   2. Drop the stale full-unique index.
 *   3. Recreate it as a PARTIAL unique index with
 *      partialFilterExpression: { deletedAt: null }, matching the model.
 *
 * Usage:
 *   node scripts/fix-question-index.mjs
 */
import mongoose from "mongoose";
import "dotenv/config";

const INDEX_NAME = "quiz_1_order_1";

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const questions = db.collection("questions");

// ── 1. Pre-check for active duplicate (quiz, order) pairs ──────────────
console.log("Pre-checking for active duplicate (quiz, order) pairs ...");
const activeDupes = await questions
  .aggregate([
    { $match: { deletedAt: null } },
    { $group: { _id: { quiz: "$quiz", order: "$order" }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 20 },
  ])
  .toArray();

if (activeDupes.length) {
  console.error(
    `ABORT: found ${activeDupes.length} active duplicate (quiz, order) groups.`
  );
  for (const d of activeDupes) {
    console.error(`  quiz=${d._id.quiz} order=${d._id.order} count=${d.count}`);
  }
  await mongoose.disconnect();
  process.exit(1);
}
console.log("No active duplicates. Safe to rebuild index.");

// ── 2. Drop stale index (if present) ───────────────────────────────────
const existing = await questions.indexes();
const oldIdx = existing.find((i) => i.name === INDEX_NAME);
if (oldIdx) {
  console.log(
    `Dropping stale index ${INDEX_NAME} (partial=${JSON.stringify(oldIdx.partialFilterExpression)}) ...`
  );
  await questions.dropIndex(INDEX_NAME);
} else {
  console.log(`Index ${INDEX_NAME} not present — nothing to drop.`);
}

// ── 3. Recreate with partial filter ────────────────────────────────────
console.log(`Creating partial unique index ${INDEX_NAME} (partialFilterExpression: { deletedAt: null }) ...`);
await questions.createIndex(
  { quiz: 1, order: 1 },
  {
    name: INDEX_NAME,
    unique: true,
    partialFilterExpression: { deletedAt: null },
  }
);

// ── 4. Verify ──────────────────────────────────────────────────────────
console.log("\nIndexes on questions after fix:");
for (const idx of await questions.indexes()) {
  console.log(
    `  ${idx.name}: ${JSON.stringify(idx.key)} partial=${JSON.stringify(idx.partialFilterExpression)} unique=${!!idx.unique}`
  );
}

await mongoose.disconnect();
console.log("\nDone.");
