/**
 * @file test-reviews.mjs
 * @description End-to-end test for the LearnX Reviews & Ratings module.
 *
 * Exercises (service-level, in-process):
 *   1. Eligibility: non-enrolled student cannot review
 *   2. Review creation -> PENDING (moderation)
 *   3. One review per student+course (duplicate blocked)
 *   4. Approval -> course stats updated (averageRating / totalReviews / distribution)
 *   5. Rating distribution correctness (multiple reviewers)
 *   6. Update review (rating change) -> stats recomputed
 *   7. Delete review -> stats recomputed
 *   8. Moderation: reject/flag uncounts; re-approve recounts
 *   9. Public listing returns APPROVED only
 *
 * Run from backend folder:
 *   node scripts/test-reviews.mjs
 */

import mongoose from "mongoose";

let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ` — ${JSON.stringify(extra)}` : ""}`); }
};

await import("dotenv/config");
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const RUN = Date.now().toString(36);

const Course = (await import("../src/models/course.model.js")).default;
const Enrollment = (await import("../src/models/enrollment.model.js")).default;
// Register the User model so populate("student") resolves in this process.
await import("../src/models/user.model.js");
const reviewService = await import("../src/services/review.service.js");
const { REVIEW_STATUS } = await import("../src/constants/review.constants.js");

async function makeUser(role, tag) {
  const email = `revu_${tag}_${RUN}@test.local`;
  const r = await db.collection("users").insertOne({
    name: tag, username: `revu_${tag}_${RUN}`, email, role, status: "active",
    createdAt: new Date(), updatedAt: new Date(),
  });
  return String(r.insertedId);
}

const instructorId = await makeUser("instructor", "ins");
const studentA = await makeUser("student", "stuA");
const studentB = await makeUser("student", "stuB");
const studentC = await makeUser("student", "stuC");
const notEnrolled = await makeUser("student", "notEnr");
const adminObj = { _id: new mongoose.Types.ObjectId(await makeUser("admin", "adm")), role: "admin" };

const course = await Course.create({
  title: `Review Course ${RUN}`, slug: `review-${RUN}`,
  description: "A sufficiently long course description to pass schema validation for the review system test scenario here.",
  shortDescription: "Review test course content.", language: "English",
  instructor: new mongoose.Types.ObjectId(instructorId),
  category: new mongoose.Types.ObjectId(),
  status: "published", visibility: "public",
  pricing: { currency: "USD", price: 0 },
});

async function enroll(studentId) {
  return Enrollment.create({
    student: new mongoose.Types.ObjectId(studentId),
    course: course._id,
    status: "ACTIVE",
    enrolledAt: new Date(),
  });
}
const eA = await enroll(studentA);
const eB = await enroll(studentB);
const eC = await enroll(studentC);

console.log(`\n== 1. Eligibility ===========================================`);
let notAllowed = false;
try {
  await reviewService.createReview({
    studentId: notEnrolled, courseId: course._id.toString(),
    data: { rating: 5, comment: "Should not work" },
  });
} catch { notAllowed = true; }
ok(notAllowed, "non-enrolled student cannot review");

console.log(`\n== 2. Creation -> PENDING ===================================`);
const rA = await reviewService.createReview({
  studentId: studentA, courseId: course._id.toString(),
  data: { rating: 5, title: "Great", comment: "Loved it" },
});
ok(rA.status === REVIEW_STATUS.PENDING, `review A created as PENDING (got ${rA.status})`);
ok(rA.rating === 5, "review A rating = 5");

console.log(`\n== 3. One review per user ===================================`);
let dup = false;
try {
  await reviewService.createReview({
    studentId: studentA, courseId: course._id.toString(),
    data: { rating: 3, comment: "dup" },
  });
} catch { dup = true; }
ok(dup, "duplicate review blocked (one per student+course)");

console.log(`\n== 4. Approval -> stats =====================================`);
await reviewService.createReview({ studentId: studentB, courseId: course._id.toString(), data: { rating: 4, comment: "Good" } });
await reviewService.createReview({ studentId: studentC, courseId: course._id.toString(), data: { rating: 4, comment: "Nice" } });

// PENDING should NOT affect stats yet.
let summary0 = await reviewService.getCourseRatingSummary({ courseId: course._id.toString() });
ok(summary0.totalReviews === 0, "stats unchanged while reviews are PENDING (totalReviews=0)");

// Approve all three (5,4,4) => avg = 4.33, count = 3, dist {4:2,5:1}
const pending = (await reviewService.getModerationQueue({ page: 1, limit: 10 })).reviews;
for (const r of pending) {
  await reviewService.moderateReview({ reviewId: String(r._id), status: REVIEW_STATUS.APPROVED, moderator: adminObj });
}
const summary = await reviewService.getCourseRatingSummary({ courseId: course._id.toString() });
ok(summary.totalReviews === 3, `totalReviews = 3 (got ${summary.totalReviews})`);
ok(summary.averageRating === 4.33, `averageRating = 4.33 (got ${summary.averageRating})`);
ok(summary.ratingDistribution[4] === 2 && summary.ratingDistribution[5] === 1,
  `distribution {4:2,5:1} (got ${JSON.stringify(summary.ratingDistribution)})`);

console.log(`\n== 6. Update -> recompute ===================================`);
const myA = await reviewService.getMyReview({ studentId: studentA, courseId: course._id.toString() });
await reviewService.updateReview({ reviewId: String(myA._id), user: { _id: new mongoose.Types.ObjectId(studentA), role: "student" }, data: { rating: 1 } });
// Now ratings: 1,4,4 => avg = 3, dist {1:1,4:2}
const summaryUpd = await reviewService.getCourseRatingSummary({ courseId: course._id.toString() });
ok(summaryUpd.averageRating === 3, `averageRating recomputed to 3 (got ${summaryUpd.averageRating})`);
ok(summaryUpd.ratingDistribution[1] === 1 && summaryUpd.ratingDistribution[4] === 2, `distribution recomputed {1:1,4:2}`);

console.log(`\n== 7. Delete -> recompute ====================================`);
await reviewService.deleteReview({ reviewId: String(myA._id), user: { _id: new mongoose.Types.ObjectId(studentA), role: "student" } });
const summaryDel = await reviewService.getCourseRatingSummary({ courseId: course._id.toString() });
ok(summaryDel.totalReviews === 2, `after delete totalReviews = 2 (got ${summaryDel.totalReviews})`);
ok(summaryDel.averageRating === 4, `after delete averageRating = 4 (got ${summaryDel.averageRating})`);

console.log(`\n== 8. Moderation reject/flag ================================`);
// Reject one of the remaining (4) => count drops to 1.
const queue = (await reviewService.getModerationQueue({ page: 1, limit: 10 })).reviews;
const remaining = queue.filter((r) => r.status === REVIEW_STATUS.APPROVED);
const toReject = await reviewService.moderateReview({ reviewId: String(remaining[0]._id), status: REVIEW_STATUS.REJECTED, moderator: adminObj, note: "spam" });
ok(toReject.status === REVIEW_STATUS.REJECTED, "review rejected");
const summaryRej = await reviewService.getCourseRatingSummary({ courseId: course._id.toString() });
ok(summaryRej.totalReviews === 1, `after reject totalReviews = 1 (got ${summaryRej.totalReviews})`);

// Re-approve the rejected one => count back to 2.
await reviewService.moderateReview({ reviewId: String(remaining[0]._id), status: REVIEW_STATUS.APPROVED, moderator: adminObj });
const summaryRe = await reviewService.getCourseRatingSummary({ courseId: course._id.toString() });
ok(summaryRe.totalReviews === 2, `re-approve restores totalReviews = 2 (got ${summaryRe.totalReviews})`);

console.log(`\n== 9. Public listing =========================================`);
const listing = await reviewService.getCourseReviews({ courseId: course._id.toString(), page: 1, limit: 10 });
ok(listing.reviews.every((r) => r.status === REVIEW_STATUS.APPROVED), "public listing shows APPROVED only");
ok(listing.pagination.total === 2, `public listing total = 2 (got ${listing.pagination.total})`);

// ── Cleanup ─────────────────────────────────────────────────────────
await Promise.all([
  db.collection("users").deleteMany({ email: { $regex: `revu_.*@test.local` } }),
  db.collection("enrollments").deleteMany({ course: course._id }),
  db.collection("reviews").deleteMany({ course: course._id }),
  Course.deleteMany({ _id: course._id }),
]);
await mongoose.disconnect();
console.log(`\n🎯 RESULT: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
