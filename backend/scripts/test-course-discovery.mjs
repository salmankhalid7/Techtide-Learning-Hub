/**
 * @file test-course-discovery.mjs
 * @description End-to-end test for Advanced Course Discovery (roadmap #8).
 *
 * Covers:
 *   1. Price filtering (free=true, minPrice, maxPrice)
 *   2. Rating filtering (minRating / maxRating)
 *   3. Tags filtering ($all)
 *   4. Featured filtering + featured rail
 *   5. Popular rail (sorted by enrollments)
 *   6. Trending rail (recent enrollment activity)
 *   7. Recommended rail (excludes enrolled, category affinity)
 *   8. Search still works + sort by rating
 *
 * Run from backend folder:  node scripts/test-course-discovery.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

import courseService from "../src/services/course.service.js";
import Course from "../src/models/course.model.js";
import Enrollment from "../src/models/enrollment.model.js";
// Register models referenced by populates (User, Category, Tag) so queries work.
import "../src/models/user.model.js";
import "../src/models/category.model.js";
import "../src/models/tag.model.js";

dotenv.config();

let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
};

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

const base = `DiscTest ${Date.now()}`;

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // Clean up orphaned courses from any prior (interrupted) runs with the
  // same prefix, so they don't pollute discovery results.
  await Course.updateMany(
    { title: { $regex: "^DiscTest " } },
    { $set: { isDeleted: true, deletedAt: new Date() } }
  );

  const instructor = await db.collection("users").findOne({ role: "instructor" });
  if (!instructor) { console.error("No instructor found."); process.exit(1); }
  const instructorAuth = { _id: instructor._id, role: instructor.role };

  // Category
  let category = await db.collection("categories").findOne({});
  if (!category) {
    const ins = await db.collection("categories").insertOne({ name: "Programming", slug: "programming", createdAt: new Date(), updatedAt: new Date() });
    category = { _id: ins.insertedId };
  }

  // Tags (Tag model not registered; insert docs into the tags collection)
  const tagA = (await db.collection("tags").insertOne({ name: "python", slug: "python", createdAt: new Date(), updatedAt: new Date() })).insertedId;
  const tagB = (await db.collection("tags").insertOne({ name: "ai", slug: "ai", createdAt: new Date(), updatedAt: new Date() })).insertedId;

  const makeCourse = (overrides = {}) =>
    courseService.createCourse(
      {
        title: `${base} ${overrides.title}`,
        shortDescription: `Short desc for ${overrides.title || "course"}.`,
        description: `This is a detailed description for the ${overrides.title || "discovery"} test course. It exists to satisfy the course model length validators used across the LearnX backend and to provide enough text for the discovery tests.`,
        pricing: { price: overrides.price ?? 0, currency: "USD" },
        courseLanguage: "English",
        category: category._id,
        tags: overrides.tags || [],
        thumbnail: { publicId: "seed/disc", url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3" },
      },
      instructorAuth
    );

  // Course A: free, featured, tagged [python], rating 5, high enrollments
  const a = await makeCourse({ title: "Alpha", price: 0, tags: [tagA], featured: true });
  // Course B: $49.99, tag [ai], rating 4, medium enrollments
  const b = await makeCourse({ title: "Beta", price: 49.99, tags: [tagB] });
  // Course C: $199, tags [python, ai], rating 3
  const c = await makeCourse({ title: "Gamma", price: 199, tags: [tagA, tagB] });
  // Course D: $10, no tags, rating 0 (unrated yet)
  const d = await makeCourse({ title: "Delta", price: 10 });

  // Publish all of them with real stats, so discovery rails/queries see them.
  for (const course of [a, b, c, d]) {
    await Course.updateOne(
      { _id: course._id },
      {
        $set: {
          status: "published",
          visibility: "public",
          publishedAt: new Date(),
          featured: course._id.toString() === a._id.toString(),
          "statistics.averageRating": course._id.toString() === a._id.toString() ? 5 : course._id.toString() === b._id.toString() ? 4 : course._id.toString() === c._id.toString() ? 3 : 0,
          "statistics.totalEnrollments": course._id.toString() === a._id.toString() ? 50 : course._id.toString() === b._id.toString() ? 30 : course._id.toString() === c._id.toString() ? 10 : 5,
        },
      }
    );
  }

  const allIds = [a._id.toString(), b._id.toString(), c._id.toString(), d._id.toString()];

  console.log("\n== 1. Price filtering ==");
  const free = await courseService.getCourses({ free: "true", limit: 50 }, null);
  ok(free.courses.some((x) => x._id.toString() === a._id.toString()), "free=true includes Alpha (price 0)");

  const cheap = await courseService.getCourses({ maxPrice: "50", limit: 50 }, null);
  ok(cheap.courses.some((x) => x._id.toString() === a._id.toString()), "maxPrice=50 includes Alpha (0)");
  ok(cheap.courses.some((x) => x._id.toString() === b._id.toString()), "maxPrice=50 includes Beta (49.99)");
  ok(!cheap.courses.some((x) => x._id.toString() === c._id.toString()), "maxPrice=50 EXCLUDES Gamma (199)");

  const pricey = await courseService.getCourses({ minPrice: "100", limit: 50 }, null);
  ok(pricey.courses.some((x) => x._id.toString() === c._id.toString()), "minPrice=100 includes Gamma");

  console.log("\n== 2. Rating filtering ==");
  const good = await courseService.getCourses({ minRating: "4", limit: 50 }, null);
  ok(good.courses.some((x) => x._id.toString() === a._id.toString()), "minRating=4 includes Alpha (5)");
  ok(good.courses.some((x) => x._id.toString() === b._id.toString()), "minRating=4 includes Beta (4)");
  ok(!good.courses.some((x) => x._id.toString() === c._id.toString()), "minRating=4 EXCLUDES Gamma (3)");

  console.log("\n== 3. Tags filtering ==");
  const python = await courseService.getCourses({ tags: tagA.toString(), limit: 50 }, null);
  ok(python.courses.every((x) => x.tags.some((t) => String(t._id || t) === String(tagA))), `tags=[python] returns only python-tagged (got ${python.courses.length})`);
  const both = await courseService.getCourses({ tags: [tagA.toString(), tagB.toString()], limit: 50 }, null);
  ok(both.courses.some((x) => x._id.toString() === c._id.toString()), "tags=[python,ai] ($all) includes Gamma (both tags)");

  console.log("\n== 4. Featured ==");
  const featuredViaFilter = await courseService.getCourses({ featured: "true", limit: 50 }, null);
  ok(featuredViaFilter.courses.every((x) => x.featured === true), "featured=true only returns featured courses");
  const featuredRail = await courseService.getFeaturedCourses({ limit: 50 });
  ok(featuredRail.courses.some((x) => x._id.toString() === a._id.toString()), "featured rail includes Alpha");

  console.log("\n== 5. Popular (by enrollments) ==");
  const popular = await courseService.getPopularCourses({ limit: 50 });
  ok(popular.courses.length >= 1, "popular returns courses");
  ok(popular.courses.length > 0 && popular.courses[0]._id.toString() === a._id.toString(), "Most-enrolled course (Alpha) ranks first");

  console.log("\n== 6. Trending (recent enrollments) ==");
  // Create a recent enrollment for course B (harness student) so it trends.
  const harnessStud = await db.collection("users").findOne({ role: "student" });
  if (harnessStud) {
    await Enrollment.updateOne(
      { student: harnessStud._id, course: b._id },
      { $set: { student: harnessStud._id, course: b._id, status: "ACTIVE", enrolledAt: new Date() } },
      { upsert: true }
    );
  }
  const trending = await courseService.getTrendingCourses({ limit: 50, days: 30 });
  ok(Array.isArray(trending.courses), "trending returns an array");

  console.log("\n== 7. Recommended (excludes enrolled + category affinity) ==");
  // If harnessStud exists, recommend for them; their enrollment in B should be excluded.
  if (harnessStud) {
    const rec = await courseService.getRecommendedCourses({ studentId: harnessStud._id, limit: 50 });
    ok(rec.courses.every((x) => x._id.toString() !== b._id.toString()), "recommended EXCLUDES the course the student is enrolled in");
    ok(Array.isArray(rec.courses), "recommended returns an array");
  }
  const recAnon = await courseService.getRecommendedCourses({ limit: 50 });
  ok(Array.isArray(recAnon.courses), "recommended works for anonymous (top-rated fallback)");

  console.log("\n== 8. Search still works ==");
  const search = await courseService.getCourses({ search: "Gamma", limit: 50 }, null);
  ok(search.courses.some((x) => x._id.toString() === c._id.toString()), "$text search finds course by title");
  const byRating = await courseService.getCourses({ sortBy: "statistics.averageRating", sortOrder: "desc", limit: 50 }, null);
  const idxAlpha = byRating.courses.findIndex((x) => x._id.toString() === a._id.toString());
  const idxGamma = byRating.courses.findIndex((x) => x._id.toString() === c._id.toString());
  ok(idxAlpha !== -1 && idxGamma !== -1 && idxAlpha < idxGamma, "sort by rating desc puts 5-star (Alpha) before 3-star (Gamma)");

  // Cleanup created courses + enrollments (soft-delete courses; drop test enrollments).
  await Course.updateMany({ _id: { $in: [a._id, b._id, c._id, d._id] } }, { $set: { isDeleted: true, deletedAt: new Date() } });
  if (harnessStud) await Enrollment.deleteMany({ _id: { $ne: null }, student: harnessStud._id, course: { $in: [a._id, b._id, c._id, d._id] } });

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
} catch (err) {
  console.error("Error:", err);
  await mongoose.disconnect();
  process.exit(1);
}
