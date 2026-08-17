/**
 * @file verify-dashboard-revenue.mjs
 * @description Verify the newly-wired dashboard revenue/earnings analytics
 *              return real (non-zero) figures once payments exist.
 *
 * Seeds an instructor, a paid order + succeeded payment (granting enrollment
 * and crediting the wallet), then asserts:
 *   - getEarningsStats(instructorId) reflects totalRevenue / balance / sales.
 *   - getRevenueAnalytics() reflects platform totalRevenue.
 *
 * Run from backend folder (services run in-process):
 *   node scripts/verify-dashboard-revenue.mjs
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
const Course = (await import("../src/models/course.model.js")).default;
const orderService = await import("../src/services/order.service.js");
const dashboardService = (await import("../src/services/dashboard.service.js")).default;

async function makeUser(role, tag) {
  const email = `rev_${tag}_${RUN}@test.local`;
  const r = await db.collection("users").insertOne({
    name: tag, username: `rev_${tag}_${RUN}`, email, role, status: "active",
    createdAt: new Date(), updatedAt: new Date(),
  });
  return String(r.insertedId);
}

const studentId = await makeUser("student", "stu");
const instructorId = await makeUser("instructor", "ins");

const course = await Course.create({
  title: `Revenue ${RUN}`, slug: `rev-${RUN}`,
  description: "A sufficiently long course description to pass the schema minlength validation for the revenue verification test.",
  shortDescription: "Revenue test course.", language: "English",
  instructor: new mongoose.Types.ObjectId(instructorId), category: new mongoose.Types.ObjectId(),
  status: "published", visibility: "public",
  pricing: { currency: "USD", price: 100 },
});

// Checkout (paid) -> grant enrollment (creates wallet credit + order PAID + payment SUCCEEDED).
const checkout = await orderService.createCheckout({
  studentId, courseId: course._id.toString(), provider: "stripe",
});
const paymentId = String(checkout.payment._id);
await orderService.grantPaidEnrollment({ paymentId });

console.log(`\n== Instructor earnings (getEarningsStats) ====================`);
const earnings = await dashboardService.getEarningsStats(instructorId);
ok(earnings.overview.totalRevenue === 90, `totalRevenue = 90 (net of 10% commission; got ${earnings.overview.totalRevenue})`);
ok(earnings.overview.totalSales === 1, `totalSales = 1 (got ${earnings.overview.totalSales})`);
ok(earnings.overview.balance === 90, `wallet balance = 90 (got ${earnings.overview.balance})`);
ok(earnings.overview.currency === "USD", "currency = USD");
ok(Array.isArray(earnings.monthlyRevenue), "monthlyRevenue is an array");
ok(earnings.monthlyRevenue.some((m) => m.month >= 1 && m.month <= 12), "monthlyRevenue has a month bucket");
ok(earnings.recentTransactions.length >= 1, "recentTransactions populated");
ok(earnings.recentTransactions[0].type === "course_sale", "first transaction = course_sale");
ok(earnings.topSellingCourses.length >= 1, "topSellingCourses populated");

console.log(`\n== Platform revenue (getRevenueAnalytics) =====================`);
const rev = await dashboardService.getRevenueAnalytics({});
ok(rev.overview.totalRevenue >= 100, `platform totalRevenue >= 100 (got ${rev.overview.totalRevenue})`);
ok(rev.overview.averageOrderValue === 100, `averageOrderValue = 100 (got ${rev.overview.averageOrderValue})`);
ok(rev.overview.monthlyRevenue >= 100, "monthlyRevenue >= 100 for current month");
ok(Array.isArray(rev.monthlyRevenue), "monthlyRevenue is an array");
ok(rev.topSellingCourses.length >= 1, "topSellingCourses populated");
ok(rev.paymentMethods.some((p) => p.provider === "stripe"), "paymentMethods includes stripe");
ok(rev.refunds.totalRefunds === 0, "no refunds yet");

// Cleanup
await Promise.all([
  db.collection("users").deleteMany({ email: { $regex: `rev_.*@test.local` } }),
  db.collection("orders").deleteMany({ student: new mongoose.Types.ObjectId(studentId) }),
  db.collection("payments").deleteMany({ student: new mongoose.Types.ObjectId(studentId) }),
  db.collection("enrollments").deleteMany({ student: new mongoose.Types.ObjectId(studentId) }),
  db.collection("wallets").deleteMany({ instructor: new mongoose.Types.ObjectId(instructorId) }),
  db.collection("invoices").deleteMany({ student: new mongoose.Types.ObjectId(studentId) }),
  Course.deleteMany({ _id: course._id }),
]);
await mongoose.disconnect();
console.log(`\n🎯 RESULT: ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
