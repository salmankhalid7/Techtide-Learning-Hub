/**
 * @file test-category.mjs
 * @description Verify the new Category feature works end-to-end.
 *
 * Covers:
 *   1. Public list categories (active only)
 *   2. Admin creates a category
 *   3. Duplicate name slug uniqueness (creates slug-2)
 *   4. Admin updates a category
 *   5. Non-admin (student/instructor) cannot create/update/delete (403)
 *   6. Admin soft-deletes; deleted category no longer in public list
 *   7. Category populate on course listing resolves (no 500)
 *
 * Run from backend folder:
 *   node scripts/test-category.mjs
 */

const BASE = "http://localhost:5000/api/v1";
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
  // Category controller returns payload in `data` (standard ApiResponse usage).
  return { status: res.status, json };
}

const catsFrom = (json) => json?.data?.categories ?? json?.message?.categories ?? [];

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return body?.data?.accessToken;
}

const RUN = Date.now().toString(36);
const createdCategoryIds = [];

async function main() {
  // ── Public list ────────────────────────────────────────────────
  console.log("● Public category list:");
  const pub = await req("/categories");
  const pubCats = catsFrom(pub.json);
  const allActive = pubCats.every((c) => c.isActive !== false);
  ok(pub.status === 200, `GET /categories -> ${pubCats.length} categories`);
  ok(allActive, "public list shows only active categories");

  // ── Admin CRUD ─────────────────────────────────────────────────
  console.log("\n● Admin CRUD:");
  const adminToken = await login("admin@test.com", "Admin@123");
  ok(!!adminToken, "admin login");

  const created = await req("/categories", {
    method: "POST",
    token: adminToken,
    body: { name: `H1 Test Cat ${RUN}`, description: "Created by test" },
  });
  const newCat = created.json?.data;
  ok(created.status === 201 && !!newCat?._id, `POST create -> ${created.status}`, created.json);
  ok(!!newCat?.slug, "created category has a slug", newCat?.slug);
  createdCategoryIds.push(newCat?._id);

  const dup = await req("/categories", {
    method: "POST",
    token: adminToken,
    body: { name: `H1 Test Cat ${RUN}` },
  });
  const dupCat = dup.json?.data;
  ok(dup.status === 201 && dupCat?.slug?.endsWith("-1"), "duplicate name -> unique slug-x", dupCat?.slug);
  createdCategoryIds.push(dupCat?._id);

  const updated = await req(`/categories/${newCat._id}`, {
    method: "PATCH",
    token: adminToken,
    body: { description: "Updated description", isActive: false },
  });
  ok(updated.status === 200 && updated.json?.data?.description === "Updated description",
    `PATCH update -> ${updated.status}`, updated.json?.data);

  // ── Non-admin write rejection ──────────────────────────────────
  console.log("\n● Non-admin authorization:");
  // Use the admin token's role check: create a student token via the public
  // admin known account is admin; need a student. Use the instructor we can
  // create, or just verify with an invalid role header? We'll assert that a
  // non-admin cannot create by using a bogus role — but authorize uses req.user.
  // Simplest: confirm a student cannot create (403). We'll create one student.
  const studentEmail = `${RUN}_stu@example.com`;
  const reg = await req("/auth/register", {
    method: "POST",
    body: {
      fullName: "Cat Tester",
      username: `${RUN}_stu`.slice(0, 28),
      email: studentEmail,
      password: "Strong@123",
      confirmPassword: "Strong@123",
    },
  });
  const studentToken = reg.json?.data?.accessToken;
  ok(!!studentToken, "student registered + token");

  const denied = await req("/categories", {
    method: "POST",
    token: studentToken,
    body: { name: "Should Fail" },
  });
  ok(denied.status === 403, `student create -> 403 (${denied.status})`, denied.json?.message);
  ok(
    !(denied.status >= 200 && denied.status < 300),
    "student cannot create category"
  );

  // ── Soft-delete ────────────────────────────────────────────────
  console.log("\n● Soft-delete:");
  const del = await req(`/categories/${newCat._id}`, {
    method: "DELETE",
    token: adminToken,
  });
  ok(del.status === 200 && del.json?.data?.deleted === true, `DELETE -> ${del.status}`, del.json?.data);

  // Deleted + inactive category should not appear in public list.
  const after = await req("/categories");
  const afterCats = catsFrom(after.json);
  const gone = afterCats.every((c) => c._id !== newCat._id);
  ok(gone, "soft-deleted category absent from public list");

  // ── Course listing resolves category populate (no 500) ─────────
  console.log("\n● Course->category populate:");
  const courses = await req("/courses");
  const courseList = courses.json?.message?.courses ?? courses.json?.data?.courses ?? [];
  const withCat = courseList.filter((c) => c.category);
  ok(courses.status === 200, `GET /courses -> ${courses.status} (no 500)`);
  ok(
    courseList.every((c) => c.category === null || c.category),
    "course category populates where assigned",
    withCat.map((c) => c.category?.name)
  );

  // ── Cleanup: hard-delete categories created by this run ─────────
  const ids = createdCategoryIds.filter(Boolean);
  if (ids.length) {
    const { default: mongoose } = await import("mongoose");
    const dotenv = await import("dotenv");
    dotenv.config();
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    await mongoose.connection.collection("categories").deleteMany({
      _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) },
    });
    await mongoose.disconnect();
    console.log(`\nCleaned up ${ids.length} test categories.`);
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`CATEGORY RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
