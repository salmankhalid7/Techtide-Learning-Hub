/**
 * @file test-marketplace.mjs
 * @description End-to-end test for the LearnX Payments/Marketplace module.
 *
 * Exercises the application-level flows that require no live payment provider
 * credentials:
 *
 *   1. Coupon create + validate
 *   2. Free course checkout -> enrollment (no payment)
 *   3. Paid course checkout -> Order + Payment created (correct money)
 *   4. Grant paid enrollment -> Enrollment + instructor wallet credit +
 *      order PAID + course totalSales
 *   5. Invoice generate + fetch
 *   6. Wallet: balance + transaction history
 *   7. Payout workflow: instructor request -> admin approve -> admin mark-paid
 *      (wallet debited + WITHDRAWAL transaction)
 *   8. Refund guard: verifying a refund on an unconfigured provider is
 *      rejected (never silently succeeds) — this is the security guardrail.
 *
 * Gateway calls (createCheckout/verifyPayment/webhook/refund against Stripe,
 * JazzCash, EasyPaisa) require real credentials and are exercised live
 * separately once keys are configured.
 *
 * Run from backend folder (server NOT required — services run in-process):
 *   node scripts/test-marketplace.mjs
 */

import mongoose from "mongoose";
import { config } from "../src/config/index.js";

/* eslint-disable no-console */
let pass = 0;
let fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ` — ${JSON.stringify(extra)}` : ""}`); }
};

await import("dotenv/config");

await mongoose.connect(process.env.MONGODB_URI);
console.log("DB connected.");

// ── Import services ─────────────────────────────────────────────────
const orderService = await import("../src/services/order.service.js");
const paymentService = await import("../src/services/payment.service.js");
const couponService = await import("../src/services/coupon.service.js");
const walletService = await import("../src/services/wallet.service.js");
const payoutService = await import("../src/services/payout.service.js");
const invoiceService = await import("../src/services/invoice.service.js");

// ── Seed users + a course ───────────────────────────────────────────
const db = mongoose.connection.db;
const RUN = Date.now().toString(36);
const Course = (await import("../src/models/course.model.js")).default;

async function makeUser(role, tag) {
  const email = `mkt_${tag}_${RUN}@test.local`;
  const res = await db.collection("users").insertOne({
    name: tag,
    username: `mkt_${tag}_${RUN}`,
    email,
    role,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return String(res.insertedId);
}

const studentId = await makeUser("student", "stu");
const instructorId = await makeUser("instructor", "ins");
const adminId = await makeUser("admin", "adm");

// Paid course.
const paidCourse = await Course.create({
  title: `Marketplace Paid ${RUN}`,
  slug: `mkt-paid-${RUN}`,
  description: "This is a comprehensive test course description that is long enough to pass schema validation for the marketplace tests.",
  shortDescription: "A test course for the marketplace paid flow.",
  language: "English",
  instructor: new mongoose.Types.ObjectId(instructorId),
  category: new mongoose.Types.ObjectId(),
  status: "published",
  visibility: "public",
  pricing: { currency: "USD", price: 100, discountedPrice: 80 },
});

// Free course.
const freeCourse = await Course.create({
  title: `Marketplace Free ${RUN}`,
  slug: `mkt-free-${RUN}`,
  description: "This is a comprehensive test course description that is long enough to pass schema validation for the marketplace tests.",
  shortDescription: "A test course for the marketplace free flow.",
  language: "English",
  instructor: new mongoose.Types.ObjectId(instructorId),
  category: new mongoose.Types.ObjectId(),
  status: "published",
  visibility: "public",
  pricing: { currency: "USD", price: 0 },
});

console.log(`\n== 1. Coupon ===============================================`);
const coupon = await couponService.createCoupon({
  user: { _id: new mongoose.Types.ObjectId(adminId) },
  data: { code: `SAVE${RUN.slice(-4).toUpperCase()}`, discountType: "percentage", discountValue: 10 },
});
ok(Boolean(coupon.code), `coupon created: ${coupon.code}`);
const validated = await couponService.validateCoupon({ code: coupon.code, courseId: paidCourse._id.toString() });
ok(validated.code === coupon.code, "coupon validates for paid course");

console.log(`\n== 2. Free course checkout =================================`);
const freeCheckout = await orderService.createCheckout({
  studentId,
  courseId: freeCourse._id.toString(),
});
ok(freeCheckout.mode === "free", "free checkout returns mode=free");
ok(Boolean(freeCheckout.enrollment), "free checkout creates enrollment");
const freeEnrollment = await db.collection("enrollments").findOne({ _id: freeCheckout.enrollment?._id });
ok(freeEnrollment?.enrollmentType === "FREE", "free enrollment type = FREE");

console.log(`\n== 3. Paid course checkout =================================`);
const paidCheckout = await orderService.createCheckout({
  studentId,
  courseId: paidCourse._id.toString(),
  provider: "stripe",
  couponCode: coupon.code,
  returnUrl: "https://example.com/success",
  cancelUrl: "https://example.com/cancel",
});
ok(paidCheckout.mode === "paid", "paid checkout returns mode=paid");
ok(paidCheckout.order.status === "PENDING_PAYMENT", "order starts PENDING_PAYMENT");
// price 80 discounted (discountedPrice < price); 10% coupon => 72
ok(paidCheckout.total === 72, `paid checkout total = 72 (got ${paidCheckout.total})`);
ok(paidCheckout.order.appliedCoupon.saved === 8, "coupon discount = 8");
ok(paidCheckout.payment.status === "PENDING", "payment starts PENDING");
ok(paidCheckout.payment.provider === "stripe", "payment provider = stripe");

console.log(`\n== 4. Grant paid enrollment ================================`);
const paymentId = String(paidCheckout.payment._id);
const granted = await orderService.grantPaidEnrollment({ paymentId });
ok(granted.enrollment || granted.alreadyEnrolled === false, "paid enrollment granted");
const paidEnrollment = granted.enrollment
  ? await db.collection("enrollments").findOne({ _id: granted.enrollment._id })
  : null;
ok(paidEnrollment?.enrollmentType === "PAID", "paid enrollment type = PAID");
ok(paidEnrollment?.order?.toString() === String(paidCheckout.order._id), "enrollment linked to order");

// Order marked PAID.
const orderDoc = await db.collection("orders").findOne({ _id: paidCheckout.order._id });
ok(orderDoc.status === "PAID", "order status = PAID");

// Wallet credited net of commission (80 * 0.7 = 56 at a 30% platform split).
let wallet = await walletService.getWallet({ instructorId });
ok(wallet.balance === 56, `instructor wallet balance = 56 (got ${wallet.balance})`);
ok(wallet.totalEarned === 56, `wallet totalEarned = 56 (got ${wallet.totalEarned})`);

// Course totalSales incremented.
const paidAfter = await db.collection("courses").findOne({ _id: paidCourse._id });
ok(paidAfter.statistics?.totalSales === 1, "course totalSales = 1");

console.log(`\n== 5. Invoice ===============================================`);
const invoice = await invoiceService.generateInvoice({ orderId: String(paidCheckout.order._id) });
ok(Boolean(invoice.invoiceNumber), "invoice generated");
ok(invoice.total === 72, `invoice total = 72 (got ${invoice.total})`);
ok(invoice.instructorNet === 56, `invoice instructorNet = 56 (got ${invoice.instructorNet})`);
ok(invoice.commission === 24, `invoice commission = 24 (got ${invoice.commission})`);
const fetchedInvoice = await invoiceService.getInvoiceForOrder({ orderId: String(paidCheckout.order._id) });
ok(Boolean(fetchedInvoice), "invoice fetched by order");

console.log(`\n== 6. Wallet transactions ==================================`);
const tx = await walletService.getTransactions({ instructorId, page: 1, limit: 10 });
ok(tx.balance === 56, "transactions view balance = 56");
ok(tx.transactions.length === 1, `transaction count = 1 (got ${tx.transactions.length})`);
ok(tx.transactions[0].type === "course_sale", "first transaction is course_sale");
ok(tx.transactions[0].direction === "credit", "course_sale is a credit");

console.log(`\n== 7. Payout workflow ======================================`);
const payoutReq = await payoutService.requestPayout({
  instructorId,
  data: { amount: 50, method: "Bank Transfer", accountDetails: "PK-XXXX" },
});
ok(payoutReq.status === "PENDING", "payout request PENDING");

// Duplicate pending request should be blocked.
let dupBlocked = false;
try { await payoutService.requestPayout({ instructorId, data: { amount: 10 } }); }
catch { dupBlocked = true; }
ok(dupBlocked, "duplicate pending payout blocked");

// Over-balance request should be blocked (fresh instructor has no wallet).
let overBlocked = false;
try {
  const ins2 = await makeUser("instructor", "ins2");
  await payoutService.requestPayout({ instructorId: ins2, data: { amount: 999999 } });
} catch { overBlocked = true; }
ok(overBlocked, "payout with no balance / over-balance rejected");

const adminObj = { _id: new mongoose.Types.ObjectId(adminId) };
const approved = await payoutService.approvePayout({ payoutId: String(payoutReq._id), admin: adminObj, adminNote: "ok" });
ok(approved.status === "APPROVED", "payout APPROVED");

const paidOut = await payoutService.markPayoutPaid({ payoutId: String(payoutReq._id), admin: adminObj });
ok(paidOut.status === "PAID", "payout PAID");

// After payout, wallet debited 50 => 56 - 50 = 6.
const walletAfter = await walletService.getWallet({ instructorId });
ok(walletAfter.balance === 6, `wallet balance after payout = 6 (got ${walletAfter.balance})`);
ok(walletAfter.totalWithdrawn === 50, `totalWithdrawn = 50 (got ${walletAfter.totalWithdrawn})`);

const txAfter = await walletService.getTransactions({ instructorId, page: 1, limit: 10 });
ok(txAfter.transactions[0].type === "withdrawal", "latest transaction is withdrawal");
ok(txAfter.transactions[0].direction === "debit", "withdrawal is a debit");

console.log(`\n== 8. Refund guard =========================================`);
// Refund requires a live gateway; with Stripe unconfigured it must throw a
// clear "not configured" error rather than silently succeeding.
let refundRejected = false;
try {
  await paymentService.refundPayment({ paymentId, reason: "test" });
} catch (err) {
  refundRejected = /not configured/i.test(err.message);
}
ok(refundRejected, "refund on unconfigured provider is rejected (security guard)");

// ── Cleanup ─────────────────────────────────────────────────────────
await Promise.all([
  db.collection("users").deleteMany({ email: { $regex: `mkt_.*@test.local` } }),
  db.collection("orders").deleteMany({ student: new mongoose.Types.ObjectId(studentId) }),
  db.collection("payments").deleteMany({ student: new mongoose.Types.ObjectId(studentId) }),
  db.collection("enrollments").deleteMany({ student: new mongoose.Types.ObjectId(studentId) }),
  db.collection("wallets").deleteMany({ instructor: new mongoose.Types.ObjectId(instructorId) }),
  db.collection("payouts").deleteMany({ instructor: new mongoose.Types.ObjectId(instructorId) }),
  db.collection("invoices").deleteMany({ student: new mongoose.Types.ObjectId(studentId) }),
  db.collection("coupons").deleteMany({ _id: coupon._id }),
  Course.deleteOne({ _id: paidCourse._id }),
  Course.deleteOne({ _id: freeCourse._id }),
]);

await mongoose.disconnect();
console.log(`\n🎯 RESULT: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
