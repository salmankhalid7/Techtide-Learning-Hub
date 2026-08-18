/**
 * @file test-notifications.mjs
 * @description End-to-end test for the LearnX Notification system.
 *
 * Exercises (service-level, in-process):
 *   1. notifyUser emits an in-app notification (defaults allowed)
 *   2. getMyNotifications lists it + getUnreadCount
 *   3. markAsRead / markAllAsRead
 *   4. deleteNotification / deleteAllNotifications
 *   5. Preference opt-out: disabling a category + inApp blocks delivery
 *   6. Event hooks: enrollment emits notifications to student + instructor;
 *      review submission emits to the course instructor
 *
 * Run from backend folder:
 *   node scripts/test-notifications.mjs
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

// Register models needed by refs/populate.
const Course = (await import("../src/models/course.model.js")).default;
const Enrollment = (await import("../src/models/enrollment.model.js")).default;
await import("../src/models/user.model.js");

const notificationService = await import("../src/services/notification.service.js");
const enrollmentService = await import("../src/services/enrollment.service.js");
const reviewService = await import("../src/services/review.service.js");
const { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } = await import(
  "../src/constants/notification.constants.js"
);

async function makeUser(role, tag) {
  const email = `notif_${tag}_${RUN}@test.local`;
  const r = await db.collection("users").insertOne({
    name: tag, username: `notif_${tag}_${RUN}`, email, role, status: "active",
    createdAt: new Date(), updatedAt: new Date(),
  });
  return String(r.insertedId);
}

const studentId = await makeUser("student", "stu");
const instructorId = await makeUser("instructor", "ins");

const course = await Course.create({
  title: `Notif Course ${RUN}`, slug: `notif-${RUN}`,
  description: "A sufficiently long course description to pass the schema minlength validation for the notification system test here.",
  shortDescription: "Notification test course.", language: "English",
  instructor: new mongoose.Types.ObjectId(instructorId),
  category: new mongoose.Types.ObjectId(),
  status: "published", visibility: "public",
  pricing: { currency: "USD", price: 0 },
});

console.log(`\n== 1. Emit + read ==========================================`);
const n = await notificationService.notifyUser({
  recipient: studentId,
  type: NOTIFICATION_TYPES.SYSTEM,
  title: "Hello",
  body: "Welcome to LearnX.",
  data: { course: course._id },
});
ok(Boolean(n), "notifyUser created a notification");
ok(n.isRead === false, "new notification is unread");

const list = await notificationService.getMyNotifications({ userId: studentId, page: 1, limit: 10 });
ok(list.notifications.length === 1, "getMyNotifications returns 1");
ok(list.pagination.total === 1, "pagination total = 1");

const unread = await notificationService.getUnreadCount({ userId: studentId });
ok(unread.count === 1, "unread count = 1");

console.log(`\n== 2. Mark read ============================================`);
const marked = await notificationService.markAsRead({ notificationId: String(n._id), userId: studentId });
ok(marked.isRead === true, "markAsRead sets isRead=true");
const unread2 = await notificationService.getUnreadCount({ userId: studentId });
ok(unread2.count === 0, "unread count = 0 after read");

// mark all read
await notificationService.notifyUser({ recipient: studentId, type: NOTIFICATION_TYPES.SYSTEM, title: "B" });
let allRes = await notificationService.markAllAsRead({ userId: studentId });
ok(allRes.modified >= 1, "markAllAsRead modified notifications");

console.log(`\n== 3. Delete ================================================`);
const del = await notificationService.deleteNotification({ notificationId: String(n._id), userId: studentId });
ok(del.deleted === true, "deleteNotification works");
let clearRes = await notificationService.deleteAllNotifications({ userId: studentId });
ok(clearRes.deleted >= 1, "deleteAllNotifications works");
const afterClear = await notificationService.getMyNotifications({ userId: studentId });
ok(afterClear.notifications.length === 0, "all notifications cleared");

console.log(`\n== 4. Preferences ==========================================`);
// Defaults allow delivery.
let prefs = await notificationService.getPreferences({ userId: studentId });
ok(prefs.email === true && prefs.inApp === true, "default preferences allow delivery");
ok(prefs.categories[NOTIFICATION_CATEGORIES.SYSTEM] === true, "system category enabled by default");

// Disable system category -> system notifications blocked.
await notificationService.updatePreferences({
  userId: studentId,
  data: { categories: { [NOTIFICATION_CATEGORIES.SYSTEM]: false } },
});
const blocked = await notificationService.notifyUser({
  recipient: studentId, type: NOTIFICATION_TYPES.SYSTEM, title: "Should drop",
});
ok(blocked === null, "notification dropped when category disabled");
const listBlocked = await notificationService.getMyNotifications({ userId: studentId });
ok(listBlocked.notifications.length === 0, "no notification delivered after opt-out");

// Turn system back on.
await notificationService.updatePreferences({
  userId: studentId,
  data: { categories: { [NOTIFICATION_CATEGORIES.SYSTEM]: true } },
});
const allowed = await notificationService.notifyUser({
  recipient: studentId, type: NOTIFICATION_TYPES.SYSTEM, title: "Back on",
});
ok(Boolean(allowed), "notification delivered after re-enabling category");

// inApp=false umbrella blocks everything.
await notificationService.updatePreferences({ userId: studentId, data: { inApp: false } });
const blockAll = await notificationService.notifyUser({
  recipient: studentId, type: NOTIFICATION_TYPES.SYSTEM, title: "Nope",
});
ok(blockAll === null, "inApp=false blocks all notifications");

console.log(`\n== 5. Event hooks ==========================================`);
// Reset prefs to enabled.
await notificationService.updatePreferences({ userId: studentId, data: { inApp: true } });

// Enrollment -> student + instructor notifications.
await enrollmentService.enrollStudent({ courseId: course._id.toString(), studentId });
const stuNotifs = await notificationService.getMyNotifications({ userId: studentId });
ok(stuNotifs.notifications.some((x) => x.type === NOTIFICATION_TYPES.COURSE_ENROLLED), "student got enrollment notification");
const insNotifs = await notificationService.getMyNotifications({ userId: instructorId });
ok(insNotifs.notifications.some((x) => x.type === NOTIFICATION_TYPES.COURSE_ENROLLED), "instructor got new-student notification");

// Review submission -> instructor review_received notification.
await reviewService.createReview({
  studentId, courseId: course._id.toString(),
  data: { rating: 5, comment: "Great" },
});
const insNotifs2 = await notificationService.getMyNotifications({ userId: instructorId });
ok(insNotifs2.notifications.some((x) => x.type === NOTIFICATION_TYPES.REVIEW_RECEIVED), "instructor got review_received notification");

// ── Cleanup ─────────────────────────────────────────────────────────
await Promise.all([
  db.collection("users").deleteMany({ email: { $regex: `notif_.*@test.local` } }),
  db.collection("enrollments").deleteMany({ course: course._id }),
  db.collection("reviews").deleteMany({ course: course._id }),
  db.collection("notifications").deleteMany({ recipient: { $in: [new mongoose.Types.ObjectId(studentId), new mongoose.Types.ObjectId(instructorId)] } }),
  db.collection("notificationpreferences").deleteMany({ user: { $in: [new mongoose.Types.ObjectId(studentId), new mongoose.Types.ObjectId(instructorId)] } }),
  Course.deleteMany({ _id: course._id }),
]);

await mongoose.disconnect();
console.log(`\n🎯 RESULT: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
