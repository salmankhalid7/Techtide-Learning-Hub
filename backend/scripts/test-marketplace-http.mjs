/**
 * @file test-marketplace-http.mjs
 * @description HTTP end-to-end test for the LearnX Payments/Marketplace module
 *              against a running server (node src/server.js on port 5000).
 *
 * Verifies the full stack (auth middleware -> validation -> controller ->
 * service -> DB) for:
 *   1. Checkout (free course => enrollment; paid course => order+payment)
 *   2. Coupon validate / admin coupon create
 *   3. Auth guarding (401 without token, 403 for wrong role)
 *   4. Payment history / order history / invoice (auth-scoped)
 *
 * Run from backend folder with the server UP:
 *   node scripts/test-marketplace-http.mjs
 */

const BASE = "http://localhost:5000/api/v1";
let pass = 0;
let fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ` — ${JSON.stringify(extra)}` : ""}`); }
};

// ── Login helpers ──────────────────────────────────────────────────
async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return { status: res.status, token: body?.data?.accessToken, body };
}

async function registerStudent() {
  const email = `httpstu_${Date.now()}@test.local`;
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "HTTP Student",
      username: `httpstu_${Date.now()}`,
      email,
      password: "Student@123",
      confirmPassword: "Student@123",
      role: "student",
    }),
  });
  const body = await res.json();
  return { status: res.status, token: body?.data?.accessToken, user: body?.data, email, body };
}

function authed(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// ── DB helpers (seed a paid + free published course) ───────────────
const mongoose = (await import("mongoose")).default;
await import("dotenv/config");
await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const RUN = Date.now().toString(36);
const Course = (await import("../src/models/course.model.js")).default;
const instructorId = new mongoose.Types.ObjectId();
const catId = new mongoose.Types.ObjectId();

const paidCourse = await Course.create({
  title: `HTTP Paid ${RUN}`,
  slug: `http-paid-${RUN}`,
  description: "A sufficiently long course description that passes the schema minlength validation for this marketplace HTTP test scenario.",
  shortDescription: "HTTP paid course for testing.",
  language: "English",
  instructor: instructorId,
  category: catId,
  status: "published",
  visibility: "public",
  pricing: { currency: "USD", price: 50 },
});
const freeCourse = await Course.create({
  title: `HTTP Free ${RUN}`,
  slug: `http-free-${RUN}`,
  description: "A sufficiently long course description that passes the schema minlength validation for this marketplace HTTP test scenario.",
  shortDescription: "HTTP free course for testing.",
  language: "English",
  instructor: instructorId,
  category: catId,
  status: "published",
  visibility: "public",
  pricing: { currency: "USD", price: 0 },
});

// ── Admin login ────────────────────────────────────────────────────
const admin = await login("admin@test.com", "Admin@123");
ok(admin.status === 200 && admin.token, "admin login");

const student = await registerStudent();
if (student.status < 200 || student.status >= 300 || !student.token) {
  console.error("Student register failed:", student.status, JSON.stringify(student.body));
}
ok(student.status >= 200 && student.status < 300 && student.token, "student register");

console.log(`\n== Auth guarding ============================================`);
let noAuth = await fetch(`${BASE}/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
ok(noAuth.status === 401, "checkout requires auth (401)");

console.log(`\n== Free course checkout (student) ==========================`);
let freeRes = await fetch(`${BASE}/checkout`, {
  method: "POST",
  headers: authed(student.token),
  body: JSON.stringify({ courseId: freeCourse._id.toString() }),
});
let freeBody = await freeRes.json();
ok(freeRes.status === 200, `free checkout HTTP ${freeRes.status}`);
ok(freeBody?.data?.checkout?.mode === "free", "free checkout mode=free");
ok(Boolean(freeBody?.data?.checkout?.enrollment?._id), "free checkout returns enrollment");

console.log(`\n== Coupon validate (student) ================================`);
let cv = await fetch(`${BASE}/coupons/validate`, {
  method: "POST",
  headers: authed(student.token),
  body: JSON.stringify({ code: "INVALIDCODE123", courseId: paidCourse._id.toString() }),
});
ok(cv.status === 400, "invalid coupon rejected (400)");

console.log(`\n== Admin coupon create ======================================`);
let cc = await fetch(`${BASE}/coupons`, {
  method: "POST",
  headers: authed(admin.token),
  body: JSON.stringify({ code: `HTTP${RUN.slice(-5).toUpperCase()}`, discountType: "fixed", discountValue: 10, currency: "USD" }),
});
let ccBody = await cc.json();
ok(cc.status === 201, `admin create coupon ${cc.status}`);
ok(Boolean(ccBody?.data?.code), "coupon code returned");
const couponCode = ccBody?.data?.code;

console.log(`\n== Paid course checkout (student) ===========================`);
let pc = await fetch(`${BASE}/checkout`, {
  method: "POST",
  headers: authed(student.token),
  body: JSON.stringify({
    courseId: paidCourse._id.toString(),
    provider: "stripe",
    couponCode,
    returnUrl: "https://example.com/success",
    cancelUrl: "https://example.com/cancel",
  }),
});
let pcBody = await pc.json();
ok(pc.status === 201, `paid checkout HTTP ${pc.status}`);
ok(pcBody?.data?.checkout?.mode === "paid", "paid checkout mode=paid");

const paymentId = pcBody?.data?.checkout?.payment?._id;
const orderId = pcBody?.data?.checkout?.order?._id;
ok(Boolean(paymentId), "payment id returned");

console.log(`\n== Payment initiate (unconfigured => 503) ====================`);
let init = await fetch(`${BASE}/payments/${paymentId}/initiate`, {
  method: "POST",
  headers: authed(student.token),
  body: JSON.stringify({ returnUrl: "https://example.com/success", cancelUrl: "https://example.com/cancel" }),
});
ok(init.status === 503, `unconfigured provider initiate -> 503 (got ${init.status})`);

console.log(`\n== Payment history (auth-scoped) ============================`);
let myPayments = await fetch(`${BASE}/payments/mine`, { headers: authed(student.token) });
let mpBody = await myPayments.json();
ok(myPayments.status === 200, "payments/mine 200");
ok(Array.isArray(mpBody?.data?.payments), "payments list returned");

console.log(`\n== Order history (auth-scoped) ==============================`);
let myOrders = await fetch(`${BASE}/orders/mine`, { headers: authed(student.token) });
let moBody = await myOrders.json();
ok(myOrders.status === 200, "orders/mine 200");
ok(Array.isArray(moBody?.data?.orders), "orders list returned");
ok(moBody?.data?.orders?.some((o) => String(o._id) === String(orderId)), "paid order in history");

console.log(`\n== Role guarding (student cannot create coupon) =============`);
let forbidden = await fetch(`${BASE}/coupons`, {
  method: "POST",
  headers: authed(student.token),
  body: JSON.stringify({ code: "TRY", discountType: "fixed", discountValue: 1 }),
});
ok(forbidden.status === 403, `student cannot create coupon (403, got ${forbidden.status})`);

// ── Cleanup ─────────────────────────────────────────────────────────
await Promise.all([
  db.collection("users").deleteMany({ email: { $regex: `httpstu_.*@test.local` } }),
  db.collection("orders").deleteMany({ "items.course": paidCourse._id }),
  db.collection("payments").deleteMany({ "order": { $in: [] } }),
  db.collection("enrollments").deleteMany({ course: { $in: [paidCourse._id, freeCourse._id] } }),
  db.collection("coupons").deleteMany({ code: couponCode }),
  db.collection("coupons").deleteMany({ code: { $regex: `HTTP${RUN.slice(-5).toUpperCase()}` } }),
  Course.deleteMany({ _id: { $in: [paidCourse._id, freeCourse._id] } }),
  db.collection("categories").deleteMany({ _id: catId }),
]).catch(() => {});

await mongoose.disconnect();
console.log(`\n🎯 HTTP RESULT: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
