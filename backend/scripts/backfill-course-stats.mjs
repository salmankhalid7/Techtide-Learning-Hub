/**
 * @file backfill-course-stats.mjs
 * @description One-time (idempotent) backfill for Course statistics.
 *
 * Fixes Phase 12 / M3: before the `refreshCourseStats` maintenance hooks were
 * wired in, existing Courses never had their `statistics.totalModules` /
 * `totalLessons` / `totalDuration` values written, so they showed `0` on
 * student enrollment cards. This script recomputes those values for every
 * non-deleted course from its actual modules/lessons.
 *
 * It REUSES the existing `refreshCourseStats(courseId)` helper (the same
 * recompute used at write-time), so it is:
 *   - SAFE  — read-only source queries + targeted `$set` per course.
 *   - IDEMPOTENT — running it again recomputes the same values; no drift.
 *   - SCOPE-LIMITED — only touches non-deleted courses; never removes fields.
 *
 * It does NOT change runtime API behavior or any service code.
 *
 * Run from the backend folder:
 *   node scripts/backfill-course-stats.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Load backend/.env (this script lives in scripts/).
dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

import Course from "../src/models/course.model.js";
import { refreshCourseStats } from "../src/helpers/courseStats.helper.js";

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 25000 });
  console.log("Connected to MongoDB.\n");

  // All non-deleted courses (find middleware would already exclude deleted,
  // but we filter explicitly for clarity + countDocuments-style safety).
  const courses = await Course.find({ isDeleted: { $ne: true } })
    .select("title status statistics")
    .lean();

  console.log(`Backfilling statistics for ${courses.length} non-deleted course(s)...\n`);

  let updated = 0;
  let errors = 0;

  for (const course of courses) {
    try {
      const before = course.statistics || {};
      await refreshCourseStats(course._id);
      const after = ((await Course.findById(course._id).select("statistics").lean()) || {}).statistics || {};
      updated += 1;
      console.log(
        `  ✓ ${String(course._id).slice(-6)} | ${before.totalModules ?? 0}/${before.totalLessons ?? 0}/${before.totalDuration ?? 0}` +
          ` -> ${after.totalModules ?? 0}/${after.totalLessons ?? 0}/${after.totalDuration ?? 0} | ${course.status} | ${course.title}`
      );
    } catch (err) {
      errors += 1;
      console.error(`  ✗ Failed for ${course._id} (${course.title}): ${err.message}`);
    }
  }

  console.log(`\nDone. ${updated} processed, ${errors} error(s).`);
  await mongoose.disconnect();
  process.exit(errors === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Backfill error:", err);
  process.exit(1);
});
