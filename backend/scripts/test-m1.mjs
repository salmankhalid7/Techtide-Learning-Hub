/**
 * @file test-m1.mjs
 * @description Verify M1 — Module service centralizes ownership checks via
 * `verifyCourseOwnership` with minimal Course projection.
 *
 * Covers:
 *  1. Course owner (instructor) can create/update/publish/archive/reorder
 *     modules (ownership preserved).
 *  2. A different instructor is FORBIDDEN (403) from mutating another course's
 *     modules.
 *  3. Admin can mutate any course's modules.
 *  4. Nonexistent module -> 404 (error preserved).
 *
 * Seeds its own course/modules via the public API and cleans up afterwards.
 *
 * Run from backend folder:
 *   node scripts/test-m1.mjs
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

const moduleFrom = (json) => json?.message ?? json?.data ?? null;
const modulesFrom = (json) => json?.message ?? json?.data ?? [];

async function registerInstructor(tag) {
  const username = `${RUN}_${tag}`.slice(0, 28);
  const email = `${RUN}_${tag}@example.com`;
  const reg = await req("/auth/register", {
    method: "POST",
    body: {
      fullName: `M1 ${tag}`,
      username,
      email,
      password: "Strong@123",
      confirmPassword: "Strong@123",
      role: "instructor",
    },
  });
  if (!reg.json?.data?.accessToken) {
    console.log(`    [debug] register ${tag} -> ${reg.status}`, JSON.stringify(reg.json).slice(0, 300));
  }
  return { token: reg.json?.data?.accessToken, userId: reg.json?.data?.user?._id, email };
}

async function createCourse(token, name) {
  const res = await req("/courses", {
    method: "POST",
    token,
    body: {
      title: name,
      shortDescription: "M1 test course with a long enough description body.",
      description: "A sufficiently long description for the M1 ownership test course body.",
      pricing: { price: 0 },
    },
  });
  return { status: res.status, id: res.json?.message?._id ?? res.json?.data?._id };
}

async function main() {
  console.log("● Setup: register two instructors + create courses");

  const A = await registerInstructor("instructor_a");
  const B = await registerInstructor("instructor_b");
  ok(!!A.token && !!B.token, "two instructors registered", { A: A.userId, B: B.userId });

  const courseA = await createCourse(A.token, `M1 Course A ${RUN}`);
  const courseB = await createCourse(B.token, `M1 Course B ${RUN}`);
  ok(courseA.status === 201 && courseA.id, `instructor A created courseA (${courseA.status})`, courseA.id);
  ok(courseB.status === 201 && courseB.id, `instructor B created courseB (${courseB.status})`, courseB.id);

  // ── Owner (A) can create module ────────────────────────────────
  console.log("\n● Owner (Instructor A) mutations:");
  const created = await req("/modules", {
    method: "POST",
    token: A.token,
    body: { course: courseA.id, title: `A Module ${RUN}`, description: "m1" },
  });
  const modA = moduleFrom(created.json);
  ok(created.status === 201 && !!modA?._id, `A creates module -> 201 (${created.status})`, created.status);

  const modId = modA?._id;

  // Owner updates
  const upd = await req(`/modules/${modId}`, {
    method: "PATCH",
    token: A.token,
    body: { title: `A Module ${RUN} updated` },
  });
  ok(upd.status === 200, `A updates module -> 200 (${upd.status})`);

  // Owner publishes
  const pub = await req(`/modules/${modId}/publish`, {
    method: "PATCH",
    token: A.token,
  });
  ok(pub.status === 200, `A publishes module -> 200 (${pub.status})`);

  // Owner reorders
  const reorder = await req("/modules/reorder", {
    method: "PATCH",
    token: A.token,
    body: { courseId: courseA.id, modules: [{ moduleId: modId, order: 1 }] },
  });
  ok(reorder.status === 200, `A reorders modules -> 200 (${reorder.status})`);

  // ── Different instructor B is FORBIDDEN ────────────────────────
  console.log("\n● Different instructor (B) forbidden:");
  const bUpdate = await req(`/modules/${modId}`, {
    method: "PATCH",
    token: B.token,
    body: { title: "hax" },
  });
  ok(bUpdate.status === 403, `B updating A's module -> 403 (${bUpdate.status})`, bUpdate.json?.message);

  const bPublish = await req(`/modules/${modId}/publish`, {
    method: "PATCH",
    token: B.token,
  });
  ok(bPublish.status === 403, `B publishing A's module -> 403 (${bPublish.status})`);

  const bCreate = await req("/modules", {
    method: "POST",
    token: B.token,
    body: { course: courseA.id, title: "B tries on A" },
  });
  ok(bCreate.status === 403, `B creating module on A's course -> 403 (${bCreate.status})`);

  const bReorder = await req("/modules/reorder", {
    method: "PATCH",
    token: B.token,
    body: { courseId: courseA.id, modules: [{ moduleId: modId, order: 2 }] },
  });
  ok(bReorder.status === 403, `B reordering A's modules -> 403 (${bReorder.status})`);

  // ── Admin CAN mutate ───────────────────────────────────────────
  console.log("\n● Admin ownership:");
  const adminLogin = await req("/auth/login", {
    method: "POST",
    body: { email: "admin@test.com", password: "Admin@123" },
  });
  const adminToken = adminLogin.json?.data?.accessToken;
  ok(!!adminToken, "admin login");

  const adminArchive = await req(`/modules/${modId}/archive`, {
    method: "PATCH",
    token: adminToken,
  });
  ok(adminArchive.status === 200, `admin archives module -> 200 (${adminArchive.status})`);

  // ── Nonexistent module ─────────────────────────────────────────
  console.log("\n● Nonexistent module:");
  const missing = await req("/modules/000000000000000000000000/publish", {
    method: "PATCH",
    token: adminToken,
  });
  ok(missing.status === 404, `publish on nonexistent module -> 404 (${missing.status})`);

  // ── Cleanup ────────────────────────────────────────────────────
  console.log("\n● Cleanup (soft-delete module + courses):");
  const delMod = await req(`/modules/${modId}`, { method: "DELETE", token: A.token });
  ok(delMod.status === 200, `A deletes its module -> 200 (${delMod.status})`);

  const delC1 = await req(`/courses/${courseA.id}`, { method: "DELETE", token: adminToken });
  const delC2 = await req(`/courses/${courseB.id}`, { method: "DELETE", token: adminToken });
  console.log(`  (cleaned courses -> ${delC1.status}, ${delC2.status})`);

  // Soft-delete test users
  const { default: mongoose } = await import("mongoose");
  const dotenv = await import("dotenv");
  dotenv.config();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const u = mongoose.connection.collection("users");
  const udel = await u.deleteMany({
    $or: [{ email: A.email }, { email: B.email }],
  });
  await mongoose.connection.collection("courses").deleteMany({
    _id: { $in: [courseA.id, courseB.id].filter(Boolean).map((i) => new mongoose.Types.ObjectId(i)) },
  });
  await mongoose.connection.collection("modules").deleteMany({ course: { $in: [courseA.id, courseB.id].filter(Boolean).map((i) => new mongoose.Types.ObjectId(i)) } });
  await mongoose.disconnect();
  console.log(`  (users deleted: ${udel.deletedCount})`);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`M1 RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
