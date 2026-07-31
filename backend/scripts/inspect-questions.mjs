/**
 * @file inspect-questions.mjs
 * @description READ-ONLY diagnostic: inspect questions for a quiz, detect
 *              order collisions, and list indexes on the questions collection.
 *
 * Usage:
 *   node scripts/inspect-questions.mjs 6a686c12a9a2d30b8da75a89
 */
import mongoose from "mongoose";
import "dotenv/config";

const QUIZ_ID = process.argv[2];

if (!QUIZ_ID) {
  console.error("Usage: node scripts/inspect-questions.mjs <quizId>");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);

const db = mongoose.connection.db;
const questions = db.collection("questions");

console.log("=== Indexes on questions ===");
const indexes = await questions.indexes();
for (const idx of indexes) {
  console.log(`  ${idx.name}: ${JSON.stringify(idx.key)} partial=${JSON.stringify(idx.partialFilterExpression)} unique=${!!idx.unique}`);
}

console.log(`\n=== All questions for quiz ${QUIZ_ID} (incl. soft-deleted) ===`);
const docs = await questions
  .find({ quiz: new mongoose.Types.ObjectId(QUIZ_ID) })
  .project({ title: 1, order: 1, deletedAt: 1, createdAt: 1 })
  .sort({ order: 1, createdAt: 1 })
  .toArray();

for (const d of docs) {
  console.log(
    `  _id=${d._id} order=${d.order} deletedAt=${d.deletedAt ?? "null"} createdAt=${d.createdAt?.toISOString()} title="${d.title?.slice(0, 40)}"`
  );
}

console.log(`\nTotal docs for quiz: ${docs.length}`);

// Detect order collisions among ACTIVE (deletedAt === null) questions
const active = docs.filter((d) => !d.deletedAt);
const counts = new Map();
for (const d of active) counts.set(d.order, (counts.get(d.order) ?? 0) + 1);
const collisions = [...counts.entries()].filter(([, c]) => c > 1);

console.log(`\nActive questions: ${active.length}`);
if (collisions.length) {
  console.log("!!! ORDER COLLISIONS AMONG ACTIVE QUESTIONS !!!");
  for (const [order, c] of collisions) {
    console.log(`  order=${order} appears ${c} times`);
  }
} else {
  console.log("No order collisions among active questions.");
}

// Sanity: any non-integer or <=0 orders?
const bad = docs.filter((d) => !Number.isInteger(d.order) || d.order < 1);
if (bad.length) {
  console.log(`\n!!! Invalid order values: ${bad.length} (id, order):`);
  for (const d of bad) console.log(`  ${d._id} -> ${d.order}`);
}

await mongoose.disconnect();
console.log("\nDone.");
