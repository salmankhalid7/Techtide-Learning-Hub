/**
 * @file test-h2.mjs
 * @description Verify H2 — `sortBy` is restricted to an allowlist on GET /courses.
 *
 * Asserts:
 *  1. Valid sortBy fields return 200 (title, createdAt, updatedAt,
 *     statistics.totalEnrollments, statistics.averageRating).
 *  2. Default (no sortBy) still works.
 *  3. Invalid sortBy (__proto__, someRandomField, empty) -> 400.
 *  4. sortOrder still restricted (asc/desc); invalid -> 400.
 *
 * Run from backend folder:
 *   node scripts/test-h2.mjs
 */

const BASE = "http://localhost:5000/api/v1";

const VALID_SORT = [
  "title",
  "createdAt",
  "updatedAt",
  "statistics.totalEnrollments",
  "statistics.averageRating",
];
const INVALID_SORT = ["__proto__", "someRandomField", "password", "statistics.__proto__"];

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

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

async function main() {
  console.log("● Valid sortBy fields:");

  for (const sortBy of VALID_SORT) {
    const r = await get(`/courses?sortBy=${encodeURIComponent(sortBy)}&sortOrder=asc`);
    ok(r.status === 200, `sortBy=${sortBy} -> 200 (${r.status})`, r.status);
  }

  console.log("\n● Default (no sortBy):");
  const def = await get("/courses");
  ok(def.status === 200, `GET /courses (no sortBy) -> 200`, def.status);

  console.log("\n● Invalid sortBy rejected:");
  for (const sortBy of INVALID_SORT) {
    const r = await get(`/courses?sortBy=${encodeURIComponent(sortBy)}`);
    ok(
      r.status === 400,
      `sortBy=${sortBy} -> 400 (${r.status})`,
      r.json?.message
    );
  }

  console.log("\n● sortOrder validation:");
  const badOrder = await get("/courses?sortOrder=DESC");
  ok(
    badOrder.status === 400,
    `sortOrder=DESC -> 400 (${badOrder.status})`
  );
  const goodOrder = await get("/courses?sortOrder=desc");
  ok(goodOrder.status === 200, `sortOrder=desc -> 200 (${goodOrder.status})`);
  const goodAsc = await get("/courses?sortBy=title&sortOrder=asc");
  ok(goodAsc.status === 200, `sortBy=title&sortOrder=asc -> 200`);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`H2 RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
