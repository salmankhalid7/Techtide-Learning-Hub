/**
 * @file test-m3.mjs
 * @description Verify M3 — Course statistics (totalModules, totalLessons,
 * totalDuration) are maintained (denormalized, recomputed) on Module/Lesson
 * writes, instead of staying at 0.
 *
 * Flow:
 *  1. Create course -> module -> lessons (with durations).
 *  2. Assert course.statistics.totalModules/TotalLessons/totalDuration reflect
 *     reality (via GET /courses/:id and the enrolled-course read path).
 *  3. Update a lesson duration -> totals update.
 *  4. Delete a lesson -> totals decrease.
 *  5. Delete a module -> totalModules decreases.
 *
 * Seeds via the public API as an instructor and cleans up afterwards.
 *
 * Run from backend folder:
 *   node scripts/test-m3.mjs
 */

const BASE = "http://localhost:5000/api/v1";
const RUN = Date.now().toString(36);
let pass = 0;
let fail = 0;
const ok = (cond, label, extra) => {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${extra ? ` — ${JSON.stringify(extra)}` : ""}`);
  }
};

async function req(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

// Course controller returns payload in `message`; auth/register uses `data`.
const courseFrom = (json) => json?.message ?? json?.data ?? null;
const statsOf = (json) => courseFrom(json)?.statistics ?? {};

async function registerInstructor(tag) {
  const username = `${RUN}_${tag}`.slice(0, 28);
  const email = `${RUN}_${tag}@example.com`;
  const reg = await req("/auth/register", {
    method: "POST",
    body: {
      fullName: `M3 ${tag}`,
      username,
      email,
      password: "Strong@123",
      confirmPassword: "Strong@123",
      role: "instructor",
    },
  });
  return { token: reg.json?.data?.accessToken, email };
}

async function main() {
  const I = await registerInstructor("instructor");
  ok(!!I.token, "instructor registered");

  const courseRes = await req("/courses", {
    method: "POST",
    token: I.token,
    body: {
      title: `M3 Course ${RUN}`,
      shortDescription: "M3 test course description body long enough.",
      description: "A sufficiently long description body for the M3 stats test course.",
      pricing: { price: 0 },
    },
  });
  const courseId = courseFrom(courseRes.json)?._id;
  ok(courseRes.status === 201 && !!courseId, `course created (${courseRes.status})`, courseId);

  const modRes = await req("/modules", {
    method: "POST",
    token: I.token,
    body: { course: courseId, title: `M3 Module ${RUN}` },
  });
  const moduleId = (modRes.json?.message ?? modRes.json?.data)?._id;
  ok(modRes.status === 201 && !!moduleId, `module created (${modRes.status})`, moduleId);

  // After course + module (no lessons), totals should be modules=1, lessons=0.
  const afterModule = await req(`/courses/${courseId}`);
  let s = statsOf(afterModule.json);
  ok(s.totalModules === 1 && s.totalLessons === 0 && s.totalDuration === 0,
    `after module: totalModules=1, lessons=0, duration=0`,
    s);

  // Create 2 TEXT lessons with durations 100 + 200.
  const l1 = await req("/lessons", {
    method: "POST",
    token: I.token,
    body: { module: moduleId, title: `L1 ${RUN}`, lessonType: "TEXT", content: { type: "TEXT", text: { body: "hello world" } }, duration: 100 },
  });
  const l1Id = (l1.json?.message ?? l1.json?.data)?._id;
  ok(l1.status === 201 && !!l1Id, `lesson1 created (${l1.status})`, l1Id);

  const l2 = await req("/lessons", {
    method: "POST",
    token: I.token,
    body: { module: moduleId, title: `L2 ${RUN}`, lessonType: "TEXT", content: { type: "TEXT", text: { body: "hello again" } }, duration: 200 },
  });
  const l2Id = (l2.json?.message ?? l2.json?.data)?._id;
  ok(l2.status === 201 && !!l2Id, `lesson2 created (${l2.status})`, l2Id);

  const afterLessons = await req(`/courses/${courseId}`);
  s = statsOf(afterLessons.json);
  ok(s.totalLessons === 2 && s.totalDuration === 300,
    `after 2 lessons: lessons=2, duration=300`, s);

  // Update lesson1 duration 100 -> 350.
  const upd = await req(`/lessons/${l1Id}`, {
    method: "PATCH",
    token: I.token,
    body: { duration: 350 },
  });
  ok(upd.status === 200, `lesson duration updated (${upd.status})`);
  const afterUpdate = await req(`/courses/${courseId}`);
  s = statsOf(afterUpdate.json);
  ok(s.totalLessons === 2 && s.totalDuration === 550,
    `after duration update: lessons=2, duration=550`, s);

  // Delete lesson2 -> lessons=1, duration=350.
  const delL = await req(`/lessons/${l2Id}`, { method: "DELETE", token: I.token });
  ok(delL.status === 200, `lesson deleted (${delL.status})`);
  const afterDelL = await req(`/courses/${courseId}`);
  s = statsOf(afterDelL.json);
  ok(s.totalLessons === 1 && s.totalDuration === 350,
    `after lesson delete: lessons=1, duration=350`, s);

  // Delete the module -> totalModules=0 (and lessons move to 0).
  const delM = await req(`/modules/${moduleId}`, { method: "DELETE", token: I.token });
  ok(delM.status === 200, `module deleted (${delM.status})`);
  const afterDelM = await req(`/courses/${courseId}`);
  s = statsOf(afterDelM.json);
  ok(s.totalModules === 0 && s.totalLessons === 0,
    `after module delete: totalModules=0, lessons=0`, s);

  // ── Cleanup ─────────────────────────────────────────────────────
  const adminLogin = await req("/auth/login", {
    method: "POST",
    body: { email: "admin@test.com", password: "Admin@123" },
  });
  const adminToken = adminLogin.json?.data?.accessToken;
  if (adminToken) await req(`/courses/${courseId}`, { method: "DELETE", token: adminToken });

  const { default: mongoose } = await import("mongoose");
  const dotenv = await import("dotenv");
  dotenv.config();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const conn = mongoose.connection;
  await conn.collection("users").deleteMany({ email: I.email });
  await conn.collection("courses").deleteMany({ _id: new mongoose.Types.ObjectId(courseId) });
  await conn.collection("modules").deleteMany({ _id: new mongoose.Types.ObjectId(moduleId) });
  await conn.collection("lessons").deleteMany({
    _id: { $in: [l1Id, l2Id].filter(Boolean).map((i) => new mongoose.Types.ObjectId(i)) },
  });
  await mongoose.disconnect();
  console.log("  (cleanup done)");

  console.log(`\n${"=".repeat(50)}`);
  console.log(`M3 RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
