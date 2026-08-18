/**
 * @file test-notifications-http.mjs
 * @description HTTP end-to-end test for the LearnX Notification system against
 *              a running server (node src/server.js on port 5000).
 *
 * Full-stack flow: student registers -> enrolls in a course (triggers an
 * enrollment notification to the student) -> reads back notifications,
 * unread count, marks read/all-read, updates preferences, clears.
 *
 * Run from backend folder with the server UP:
 *   node scripts/test-notifications-http.mjs
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

const instructorId = new mongoose.Types.ObjectId();
const catId = new mongoose.Types.ObjectId();
const course = await Course.create({
  title: `HTTP Notif ${RUN}`, slug: `http-notif-${RUN}`,
  description: "A sufficiently long course description to pass the schema minlength validation for the notification HTTP test scenario.",
  shortDescription: "Notification HTTP course.", language: "English",
  instructor: instructorId, category: catId,
  status: "published", visibility: "public",
  pricing: { currency: "USD", price: 0 },
});

async function registerStudent(tag) {
  const email = `httprnot_${tag}_${Date.now()}@test.local`;
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Notif Student", username: `httprnot_${tag}_${Date.now()}`,
      email, password: "Notif@123", confirmPassword: "Notif@123", role: "student",
    }),
  });
  const body = await res.json();
  return { status: res.status, token: body?.data?.accessToken, studentId: body?.data?.user?._id || null, body };
}
const auth = (t) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

const student = await registerStudent("a");
ok(student.status >= 200 && student.status < 300 && student.token, "student register");

// Seed an ACTIVE enrollment directly so the student can enroll via service-level
// hook on the running server: actually the running server emits enrollment
// notifications when the enroll endpoint is used. We'll seed the enrollment
// via DB to keep it simple, then manually call the notification service emit
// through a direct DB route? Instead, trigger via the enroll HTTP endpoint.

console.log(`\n== Trigger enrollment notification =========================`);
// Enroll via HTTP endpoint (server emits student+instructor notifications).
let enrollRes = await fetch(`${BASE}/courses/${course._id.toString()}/enroll`, {
  method: "POST", headers: auth(student.token),
  body: JSON.stringify({}),
});
ok(enrollRes.status === 200 || enrollRes.status === 201, `enroll HTTP ${enrollRes.status}`);

console.log(`\n== Read notifications ======================================`);
let list = await fetch(`${BASE}/notifications/mine`, { headers: auth(student.token) });
let listBody = await list.json();
ok(list.status === 200, "notifications/mine 200");
ok(Array.isArray(listBody?.data?.notifications), "notifications is an array");
ok(listBody?.data?.notifications?.some((x) => x.type === "course_enrolled"), "student has course_enrolled notification");

let unread = await fetch(`${BASE}/notifications/unread-count`, { headers: auth(student.token) });
let unreadBody = await unread.json();
ok(unread.status === 200, "unread-count 200");
ok(unreadBody?.data?.count >= 1, `unread count >= 1 (got ${unreadBody?.data?.count})`);

const firstId = listBody?.data?.notifications?.[0]?._id;

console.log(`\n== Mark as read / all ======================================`);
if (firstId) {
  let markOne = await fetch(`${BASE}/notifications/${firstId}/read`, { method: "PATCH", headers: auth(student.token) });
  let markOneBody = await markOne.json();
  ok(markOne.status === 200, "mark one read 200");
  ok(markOneBody?.data?.isRead === true, "notification marked read");
}
let markAll = await fetch(`${BASE}/notifications/read-all`, { method: "PATCH", headers: auth(student.token) });
ok(markAll.status === 200, "mark-all 200");
let unread2 = await fetch(`${BASE}/notifications/unread-count`, { headers: auth(student.token) });
let unread2Body = await unread2.json();
ok(unread2Body?.data?.count === 0, "unread count = 0 after mark all");

console.log(`\n== Preferences ==============================================`);
let prefsGet = await fetch(`${BASE}/notifications/preferences`, { headers: auth(student.token) });
let prefsBody = await prefsGet.json();
ok(prefsGet.status === 200, "get preferences 200");
ok(prefsBody?.data?.inApp === true, "default inApp = true");

let prefsUpd = await fetch(`${BASE}/notifications/preferences`, {
  method: "PATCH", headers: auth(student.token),
  body: JSON.stringify({ email: false, inApp: true, categories: { system: false } }),
});
let prefsUpdBody = await prefsUpd.json();
ok(prefsUpd.status === 200, "update preferences 200");
ok(prefsUpdBody?.data?.email === false, "email preference updated");
ok(prefsUpdBody?.data?.categories?.system === false, "system category updated to false");

console.log(`\n== Auth guarding ============================================`);
let noAuth = await fetch(`${BASE}/notifications/mine`);
ok(noAuth.status === 401, "notifications requires auth (401)");

// Cleanup
await Promise.all([
  db.collection("users").deleteMany({ email: { $regex: `httprnot_.*@test.local` } }),
  db.collection("enrollments").deleteMany({ course: course._id }),
  db.collection("notifications").deleteMany({}),
  db.collection("notificationpreferences").deleteMany({}),
  Course.deleteMany({ _id: course._id }),
  db.collection("categories").deleteMany({ _id: catId }),
]).catch(() => {});
await mongoose.disconnect();
console.log(`\n🎯 HTTP NOTIF RESULT: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
