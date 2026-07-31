/**
 * @file inspect-reorder-state.mjs
 * @description READ-ONLY: lists all ACTIVE questions grouped by quiz with
 *              their current orders, so reorder collisions can be diagnosed.
 */
import mongoose from "mongoose";
import "dotenv/config";

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const questions = db.collection("questions");

const docs = await questions
  .find({ deletedAt: null })
  .project({ quiz: 1, order: 1, title: 1 })
  .sort({ quiz: 1, order: 1 })
  .toArray();

const byQuiz = new Map();
for (const d of docs) {
  const key = d.quiz.toString();
  if (!byQuiz.has(key)) byQuiz.set(key, []);
  byQuiz.get(key).push(d);
}

for (const [quiz, qs] of byQuiz) {
  console.log(`\nquiz=${quiz}  activeCount=${qs.length}`);
  for (const q of qs) {
    console.log(`  order=${q.order}  _id=${q._id}  "${String(q.title).slice(0, 45)}"`);
  }
}

if (!byQuiz.size) console.log("\nNo active questions found.");

await mongoose.disconnect();
console.log("\nDone.");
