/**
 * @file test-h3.mjs
 * @description Verify H3 — public Module GET endpoints no longer expose
 * draft/archived/private/unpublished content.
 *
 * Asserts:
 *  1. Anonymous GET /modules/course/:courseId for a DRAFT course -> [].
 *  2. Anonymous GET /modules/course/:courseId for a PUBLISHED+public course
 *     -> only published modules.
 *  3. Anonymous GET /modules/:moduleId for a draft module -> 404.
 *  4. Anonymous GET /modules/:moduleId for a published module -> 200.
 *  5. Owner/admin (Bearer) can still see their drafts via the same endpoints.
 *
 * Run from backend folder:
 *   node scripts/test-h3.mjs
 *
 * NOTE: substitute the IDs below with real ones from your DB.
 */

const BASE = "http://localhost:5000/api/v1";

const DRAFT_COURSE_ID = "6a61f774bcc20c1708e90c2c"; // draft course (non-deleted)
const DRAFT_MODULE_ID = "6a61fde1e2d5b36155049448"; // draft module in DRAFT_COURSE_ID
const PUBLISHED_COURSE_ID = "6a72e252513997eec70734db"; // published+public course
const PUBLISHED_MODULE_ID = "6a72e253513997eec70734dc"; // published module in PUBLISHED_COURSE_ID

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

async function get(path, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${BASE}${path}`, { headers });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return body?.data?.accessToken;
}

// module controller uses swapped ApiResponse: payload is in `message`.
const modulesFrom = (json) =>
  json?.message ?? json?.data ?? [];

async function main() {
  // ── Anonymous: course modules ───────────────────────────────────
  console.log("● Anonymous — GET /modules/course/:courseId:");

  const draftCourse = await get(`/modules/course/${DRAFT_COURSE_ID}`);
  const draftModules = modulesFrom(draftCourse.json);
  ok(
    Array.isArray(draftModules) && draftModules.length === 0 && draftCourse.status === 200,
    `draft course -> empty module list (${draftModules.length})`,
    draftModules.map((m) => m.status)
  );

  const pubCourse = await get(`/modules/course/${PUBLISHED_COURSE_ID}`);
  const pubModules = modulesFrom(pubCourse.json);
  const allPub = Array.isArray(pubModules) && pubModules.every((m) => m.status === "published");
  ok(
    pubCourse.status === 200 &&
      Array.isArray(pubModules) &&
      pubModules.length > 0 &&
      allPub,
    `published course -> only published modules (${pubModules.length})`,
    pubModules.map((m) => m.status)
  );

  // ── Anonymous: single module ────────────────────────────────────
  console.log("\n● Anonymous — GET /modules/:moduleId:");

  const draftMod = await get(`/modules/${DRAFT_MODULE_ID}`);
  ok(
    draftMod.status === 404,
    `draft module in draft course -> 404 (${draftMod.status})`,
    draftMod.json?.message
  );

  const pubMod = await get(`/modules/${PUBLISHED_MODULE_ID}`);
  ok(
    pubMod.status === 200,
    `published module in published course -> 200 (${pubMod.status})`,
    pubMod.json?.message?.title
  );

  // ── Owner/admin access preserved ────────────────────────────────
  console.log("\n● Owner/admin (Bearer) access:");

  // Use a draft module owned by an instructor. Here we use the admin account,
  // which can access all modules regardless of publish state.
  const adminToken = await login("admin@test.com", "Admin@123");
  ok(!!adminToken, "admin login");

  const adminDraftMod = await get(`/modules/${DRAFT_MODULE_ID}`, adminToken);
  ok(
    adminDraftMod.status === 200,
    `admin can read draft module -> 200 (${adminDraftMod.status})`,
    adminDraftMod.json?.message?.title
  );

  const adminDraftCourse = await get(`/modules/course/${DRAFT_COURSE_ID}`, adminToken);
  const adminDraftModules = modulesFrom(adminDraftCourse.json);
  ok(
    adminDraftCourse.status === 200,
    `admin can list draft course modules -> 200 (${adminDraftModules.length})`,
    adminDraftModules.map((m) => m.status)
  );

  console.log(`\n${"=".repeat(50)}`);
  console.log(`H3 RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
