/**
 * @file test-l3.mjs
 * @description Verify L3 — Module reorder is wrapped in a MongoDB transaction.
 *
 * Covers:
 *  1. Owner reorders modules -> 200, orders applied (commit).
 *  2. Admin reorders -> 200.
 *  3. Different instructor -> 403 (auth before transaction).
 *  4. Invalid membership (one module not in course) -> 400, AND the order of
 *     the valid modules is UNCHANGED (proves transaction rollback — no partial
 *     application).
 *  5. Response returns the reordered active module list.
 *
 * Seeds its own course + modules via the public API and cleans up.
 *
 * Run from backend folder:
 *   node scripts/test-l3.mjs
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

const from = (json) => json?.message ?? json?.data ?? null;

async function registerInstructor(tag) {
  const username = `${RUN}_${tag}`.slice(0, 28);
  const email = `${RUN}_${tag}@example.com`;
  const reg = await req("/auth/register", {
    method: "POST",
    body: {
      fullName: `L3 ${tag}`,
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
  const A = await registerInstructor("instructor_a");
  const B = await registerInstructor("instructor_b");
  ok(!!A.token && !!B.token, "two instructors registered");

  // Create course + 3 modules (orders 1,2,3)
  const courseRes = await req("/courses", {
    method: "POST",
    token: A.token,
    body: {
      title: `L3 Course ${RUN}`,
      shortDescription: "L3 test course short description ok.",
      description: "A sufficiently long description body for the L3 transaction test course.",
      pricing: { price: 0 },
    },
  });
  const courseId = from(courseRes.json)?._id;
  ok(courseRes.status === 201 && !!courseId, `course created (${courseRes.status})`, courseId);

  const modIds = [];
  for (let i = 1; i <= 3; i++) {
    const m = await req("/modules", { method: "POST", token: A.token, body: { course: courseId, title: `L3 M${i} ${RUN}` } });
    modIds.push(from(m.json)?._id);
  }
  ok(modIds.every(Boolean), "three modules created", modIds);

  const ownerList = async () => {
    const r = await req(`/modules/course/${courseId}`, { token: A.token });
    const arr = Array.isArray(from(r.json)) ? from(r.json) : [];
    return arr.map((m) => ({ _id: String(m._id), order: m.order }));
  };

  // ── Owner reorder to reverse (3,2,1) ─────────────────────────────
  console.log("\n● Owner reorder (successful transaction):");
  const rev = await req("/modules/reorder", {
    method: "PATCH",
    token: A.token,
    body: { courseId, modules: [
      { moduleId: modIds[2], order: 1 },
      { moduleId: modIds[1], order: 2 },
      { moduleId: modIds[0], order: 3 },
    ] },
  });
  const afterRev = from(rev.json);
  ok(rev.status === 200, `reorder -> 200 (${rev.status})`);
  const orderOf = (list) => list.map((x) => x.order).join(",");
  ok(
    Array.isArray(afterRev) && afterRev.length === 3,
    "reorder returns 3 modules"
  );
  ok(
    afterRev.find((m) => String(m._id) === String(modIds[2]))?.order === 1 &&
      afterRev.find((m) => String(m._id) === String(modIds[0]))?.order === 3,
    "orders applied as requested"
  );

  // ── Admin reorder (back to 1,2,3) ────────────────────────────────
  console.log("\n● Admin reorder:");
  const adminLogin = await req("/auth/login", { method: "POST", body: { email: "admin@test.com", password: "Admin@123" } });
  const adminToken = adminLogin.json?.data?.accessToken;
  ok(!!adminToken, "admin login");
  const adm = await req("/modules/reorder", {
    method: "PATCH",
    token: adminToken,
    body: { courseId, modules: [
      { moduleId: modIds[0], order: 1 },
      { moduleId: modIds[1], order: 2 },
      { moduleId: modIds[2], order: 3 },
    ] },
  });
  ok(adm.status === 200, `admin reorder -> 200 (${adm.status})`);

  // ── Different instructor -> 403 (transaction not reached) ────────
  console.log("\n● Different instructor forbidden:");
  const forb = await req("/modules/reorder", {
    method: "PATCH",
    token: B.token,
    body: { courseId, modules: [{ moduleId: modIds[0], order: 10 }] },
  });
  ok(forb.status === 403, `B reorder -> 403 (${forb.status})`);

  // ── Invalid membership -> 400 AND atomic rollback ────────────────
  console.log("\n● Invalid membership (rollback check):");
  const foreignId = "000000000000000000000000"; // not in this course
  const before = await ownerList();
  const bad = await req("/modules/reorder", {
    method: "PATCH",
    token: A.token,
    body: { courseId, modules: [
      { moduleId: modIds[0], order: 90 },
      { moduleId: modIds[1], order: 91 },
      { moduleId: foreignId, order: 92 }, // causes membership to fail
    ] },
  });
  ok(bad.status === 400, `invalid membership -> 400 (${bad.status})`);
  const afterBad = await ownerList();
  ok(
    JSON.stringify(before) === JSON.stringify(afterBad),
    "orders UNCHANGED after failed reorder (transaction rolled back)",
    { before: before.map((x) => x.order), after: afterBad.map((x) => x.order) }
  );

  // ── Cleanup ──────────────────────────────────────────────────────
  if (adminToken) await req(`/courses/${courseId}`, { method: "DELETE", token: adminToken });
  const { default: mongoose } = await import("mongoose");
  const dotenv = await import("dotenv");
  dotenv.config();
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 25000 });
  const conn = mongoose.connection;
  await conn.collection("users").deleteMany({
    $or: [{ email: A.email }, { email: B.email }],
  });
  const oid = new mongoose.Types.ObjectId(courseId);
  await conn.collection("courses").deleteMany({ _id: oid });
  await conn.collection("modules").deleteMany({ course: oid });
  await mongoose.disconnect().catch(() => {});
  console.log("  (cleanup attempted)");

  console.log(`\n${"=".repeat(50)}`);
  console.log(`L3 RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
