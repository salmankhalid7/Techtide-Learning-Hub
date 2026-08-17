/**
 * @file test-reviews-http.mjs
 * @description HTTP end-to-end test for the LearnX Reviews module against a
 *              running server (node src/server.js on port 5000).
 *
 * Full stack flow: student registers -> enrolls (seeded) -> submits a review ->
 * admin approves via moderation -> public listing + rating summary reflect it.
 *
 * Run from backend folder with the server UP:
 *   node scripts/test-reviews-http.mjs
 */

const BASE = "http://localhost:5000/api/v1";
let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ` — ${JSON.stringify(extra)}` : ""}`); }
};

const mongoose = (await import("mongoose")).default;
await import("dotenv/config");
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const RUN = Date.now().toString(36);
const Course = (await import("../src/models/course.model.js")).default;

// Seed a course + instructor + student (must match register for auth).
const instructorId = new mongoose.Types.ObjectId();
const catId = new mongoose.Types.ObjectId();
const course = await Course.create({
  title: `HTTP Review ${RUN}`, slug: `http-review-${RUN}`,
  description: "A sufficiently long course description to pass schema validation for the review HTTP test scenario here.",
  shortDescription: "HTTP review course test.", language: "English",
  instructor: instructorId, category: catId,
  status: "published", visibility: "public",
  pricing: { currency: "USD", price: 0 },
});

async function registerStudent() {
  const email = `httprev_${Date.now()}@test.local`;
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "HTTP Reviewer", username: `httprev_${Date.now()}`,
      email, password: "Review@123", confirmPassword: "Review@123", role: "student",
    }),
  });
  const body = await res.json();
  return { status: res.status, token: body?.data?.accessToken, studentId: body?.data?.user?._id || null, email, body };
}
async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", password: "Admin@123" }),
  });
  const body = await res.json();
  return { token: body?.data?.accessToken };
}
const auth = (t) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

const student = await registerStudent();
ok(student.status >= 200 && student.status < 300 && student.token, "student register");
const admin = await login();
ok(Boolean(admin.token), "admin login");

// Seed an ACTIVE enrollment so the student is eligible.
await db.collection("enrollments").insertOne({
  student: new mongoose.Types.ObjectId(student.studentId),
  course: course._id, status: "ACTIVE", enrolledAt: new Date(), lastAccessedAt: new Date(),
});

console.log(`\n== Student submits review ==================================`);
let create = await fetch(`${BASE}/courses/${course._id}/reviews`, {
  method: "POST", headers: auth(student.token),
  body: JSON.stringify({ rating: 4, title: "Nice", comment: "Good course" }),
});
let createBody = await create.json();
ok(create.status === 201, `create review ${create.status}`);
ok(createBody?.data?.status === "PENDING", "review starts PENDING");
const reviewId = createBody?.data?._id;

console.log(`\n== Admin moderation queue ==================================`);
let queue = await fetch(`${BASE}/reviews/moderation`, { headers: auth(admin.token) });
let queueBody = await queue.json();
ok(queue.status === 200, "moderation queue 200");
ok(queueBody?.data?.reviews?.some((r) => String(r._id) === String(reviewId)), "review in queue");

console.log(`\n== Admin approve ===========================================`);
let approve = await fetch(`${BASE}/reviews/${reviewId}/moderate`, {
  method: "PATCH", headers: auth(admin.token),
  body: JSON.stringify({ status: "APPROVED" }),
});
ok(approve.status === 200, "moderate approve 200");

console.log(`\n== Public listing + rating =================================`);
let list = await fetch(`${BASE}/courses/${course._id}/reviews`);
let listBody = await list.json();
ok(list.status === 200, "public reviews 200");
ok(listBody?.data?.reviews?.some((r) => String(r._id) === String(reviewId) && r.status === "APPROVED"), "approved review visible publicly");

let rating = await fetch(`${BASE}/courses/${course._id}/rating`);
let ratingBody = await rating.json();
ok(rating.status === 200, "public rating 200");
ok(ratingBody?.data?.averageRating === 4, `averageRating = 4 (got ${ratingBody?.data?.averageRating})`);
ok(ratingBody?.data?.totalReviews === 1, "totalReviews = 1");
ok(ratingBody?.data?.ratingDistribution[4] === 1, "distribution[4] = 1");

// Student eligibility: non-enrolled user cannot review (use a fresh student without enrollment).
console.log(`\n== Eligibility via HTTP ====================================`);
const stranger = await registerStudent();
let forbidden = await fetch(`${BASE}/courses/${course._id}/reviews`, {
  method: "POST", headers: auth(stranger.token),
  body: JSON.stringify({ rating: 5, comment: "nope" }),
});
ok(forbidden.status === 400, `non-enrolled cannot review (400, got ${forbidden.status})`);

// Cleanup
await Promise.all([
  db.collection("users").deleteMany({ email: { $regex: `httprev_.*@test.local` } }),
  db.collection("enrollments").deleteMany({ course: course._id }),
  db.collection("reviews").deleteMany({ course: course._id }),
  Course.deleteMany({ _id: course._id }),
  db.collection("categories").deleteMany({ _id: catId }),
]).catch(() => {});
await mongoose.disconnect();
console.log(`\n🎯 HTTP REVIEW RESULT: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
