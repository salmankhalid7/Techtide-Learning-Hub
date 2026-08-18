/**
 * @file test-announcements.mjs
 * @description End-to-end test for the LearnX Course Announcements module.
 *
 * Exercises (service-level, in-process):
 *   1. Instructor creates an announcement (DRAFT)
 *   2. Draft is NOT in the student feed
 *   3. Publish -> enrolled students get a NEW_ANNOUNCEMENT notification
 *   4. Published announcement appears in the student feed
 *   5. Non-enrolled student cannot see the course's announcements (feed 403)
 *   6. Update + re-publish + delete
 *   7. Ownership enforcement (another instructor cannot manage)
 *
 * Run from backend folder:
 *   node scripts/test-announcements.mjs
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
const Notification = (await import("../src/models/notification.model.js")).default;
await import("../src/models/user.model.js");

const announcementService = await import("../src/services/announcement.service.js");
const { NOTIFICATION_TYPES } = await import("../src/constants/notification.constants.js");
const { ANNOUNCEMENT_STATUS } = await import("../src/constants/announcement.constants.js");

async function makeUser(role, tag) {
  const email = `ann_${tag}_${RUN}@test.local`;
  const r = await db.collection("users").insertOne({
    name: tag, username: `ann_${tag}_${RUN}`, email, role, status: "active",
    createdAt: new Date(), updatedAt: new Date(),
  });
  return String(r.insertedId);
}

const instructorId = await makeUser("instructor", "ins");
const instructorOther = await makeUser("instructor", "ins2");
const studentA = await makeUser("student", "stuA");
const studentB = await makeUser("student", "stuB");
const outsider = await makeUser("student", "outsider");

const course = await Course.create({
  title: `Ann Course ${RUN}`, slug: `ann-${RUN}`,
  description: "A sufficiently long course description to pass the schema minlength validation for the announcements test scenario.",
  shortDescription: "Announcement test course.", language: "English",
  instructor: new mongoose.Types.ObjectId(instructorId),
  category: new mongoose.Types.ObjectId(),
  status: "published", visibility: "public",
  pricing: { currency: "USD", price: 0 },
});

// Enroll students A + B (outsider is NOT enrolled).
await Enrollment.insertMany([
  { student: new mongoose.Types.ObjectId(studentA), course: course._id, status: "ACTIVE", enrolledAt: new Date() },
  { student: new mongoose.Types.ObjectId(studentB), course: course._id, status: "ACTIVE", enrolledAt: new Date() },
]);

const instructorUser = { _id: new mongoose.Types.ObjectId(instructorId), role: "instructor" };
const otherInstructorUser = { _id: new mongoose.Types.ObjectId(instructorOther), role: "instructor" };

console.log(`\n== 1. Create announcement (DRAFT) ==========================`);
const created = await announcementService.createAnnouncement({
  courseId: course._id.toString(),
  user: instructorUser,
  data: { title: "New lesson added", body: "A new lesson has been added to Module 4." },
});
ok(created.status === ANNOUNCEMENT_STATUS.DRAFT, "announcement created as DRAFT");
const announcementId = String(created._id);

console.log(`\n== 2. Draft not in student feed =============================`);
let feedDraft = await announcementService.getStudentFeed({ studentId: studentA, page: 1, limit: 10 });
ok(feedDraft.announcements.length === 0, "draft not visible to students");

console.log(`\n== 3. Publish -> notify enrolled ============================`);
const published = await announcementService.publishAnnouncement({ announcementId, user: instructorUser });
ok(published.status === ANNOUNCEMENT_STATUS.PUBLISHED, "announcement published");
ok(Boolean(published.publishedAt), "publishedAt set");

const notifA = await Notification.findOne({ recipient: studentA, type: NOTIFICATION_TYPES.NEW_ANNOUNCEMENT });
ok(Boolean(notifA), "student A got NEW_ANNOUNCEMENT notification");
const notifB = await Notification.findOne({ recipient: studentB, type: NOTIFICATION_TYPES.NEW_ANNOUNCEMENT });
ok(Boolean(notifB), "student B got NEW_ANNOUNCEMENT notification");
const notifOutsider = await Notification.findOne({ recipient: outsider, type: NOTIFICATION_TYPES.NEW_ANNOUNCEMENT });
ok(!notifOutsider, "non-enrolled outsider got no notification");

console.log(`\n== 4. Publish appears in feed ===============================`);
let feedA = await announcementService.getStudentFeed({ studentId: studentA, page: 1, limit: 10 });
ok(feedA.announcements.length === 1, "published announcement in student A feed");
ok(feedA.announcements[0].status === ANNOUNCEMENT_STATUS.PUBLISHED, "feed shows published only");
let feedB = await announcementService.getStudentFeed({ studentId: studentB, courseId: course._id.toString(), page: 1, limit: 10 });
ok(feedB.announcements.length === 1, "course-scoped feed works for student B");

console.log(`\n== 5. Non-enrolled cannot see feed ==========================`);
let outsiderBlocked = false;
try {
  await announcementService.getStudentFeed({ studentId: outsider, courseId: course._id.toString(), page: 1, limit: 10 });
} catch (e) {
  outsiderBlocked = e.name === "ForbiddenError" || /not enrolled/i.test(e.message);
}
ok(outsiderBlocked, "non-enrolled student blocked from course feed");

console.log(`\n== 6. Update / re-publish / delete ==========================`);
const updated = await announcementService.updateAnnouncement({
  announcementId, user: instructorUser,
  data: { body: "Updated: two lessons added." },
});
ok(updated.body.includes("Updated"), "announcement updated");

// Re-publish should NOT duplicate notifications.
await announcementService.publishAnnouncement({ announcementId, user: instructorUser });
const notifCountA = await Notification.countDocuments({ recipient: studentA, type: NOTIFICATION_TYPES.NEW_ANNOUNCEMENT });
ok(notifCountA === 1, `re-publish does not duplicate notification (count=${notifCountA})`);

const del = await announcementService.deleteAnnouncement({ announcementId, user: instructorUser });
ok(del.deleted === true, "announcement deleted");
let feedAfterDel = await announcementService.getStudentFeed({ studentId: studentA, page: 1, limit: 10 });
ok(feedAfterDel.announcements.length === 0, "deleted announcement removed from feed");

console.log(`\n== 7. Ownership enforcement =================================`);
const otherCreated = await announcementService.createAnnouncement({
  courseId: course._id.toString(),
  user: instructorUser,
  data: { title: "T2", body: "B2" },
});
let otherBlocked = false;
try {
  await announcementService.updateAnnouncement({ announcementId: String(otherCreated._id), user: otherInstructorUser, data: { body: "x" } });
} catch (e) {
  otherBlocked = e.name === "ForbiddenError" || /not allowed/i.test(e.message);
}
ok(otherBlocked, "another instructor cannot manage this announcement");

// ── Cleanup ─────────────────────────────────────────────────────────
await Promise.all([
  db.collection("users").deleteMany({ email: { $regex: `ann_.*@test.local` } }),
  db.collection("enrollments").deleteMany({ course: course._id }),
  db.collection("announcements").deleteMany({ course: course._id }),
  db.collection("notifications").deleteMany({ recipient: { $in: [new mongoose.Types.ObjectId(studentA), new mongoose.Types.ObjectId(studentB), new mongoose.Types.ObjectId(outsider)] } }),
  Course.deleteMany({ _id: course._id }),
]);

await mongoose.disconnect();
console.log(`\n🎯 RESULT: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
