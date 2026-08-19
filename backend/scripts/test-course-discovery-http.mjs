/**
 * @file test-course-discovery-http.mjs
 * @description HTTP smoke test for Advanced Course Discovery routes.
 *
 * Requires server running (node src/server.js). Verifies:
 *   1. GET /courses/featured  -> 200 (public, optional auth)
 *   2. GET /courses/popular   -> 200
 *   3. GET /courses/trending  -> 200
 *   4. GET /courses/recommended -> 200
 *   5. GET /courses?minPrice=..&maxPrice=..&minRating=..&featured=true -> 200
 *   6. Invalid filter (free=maybe) -> 400
 *   7. GET /courses/:someRealId -> still works (rails don't shadow it)
 *
 * Run: node scripts/test-course-discovery-http.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const BASE = `http://localhost:${process.env.PORT || 5000}/api/v1`;

let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
};

async function call(path, method = "GET") {
  const res = await fetch(`${BASE}${path}`, { method });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { status: res.status, data };
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  console.log("\n== Discovery rails (public) ==");
  const featured = await call("/courses/featured");
  ok(featured.status === 200, `GET /courses/featured -> 200 (got ${featured.status})`);

  const popular = await call("/courses/popular");
  ok(popular.status === 200, `GET /courses/popular -> 200 (got ${popular.status})`);

  const trending = await call("/courses/trending");
  ok(trending.status === 200, `GET /courses/trending -> 200 (got ${trending.status})`);

  const recommended = await call("/courses/recommended");
  ok(recommended.status === 200, `GET /courses/recommended -> 200 (got ${recommended.status})`);

  console.log("\n== Combined filters ==");
  const filters = await call("/courses?minPrice=1&maxPrice=200&minRating=3&featured=true");
  ok(filters.status === 200, `GET /courses with price+rating+featured filters -> 200 (got ${filters.status})`);

  console.log("\n== Validation (invalid values -> 400) ==");
  const badFree = await call("/courses?free=maybe");
  ok(badFree.status === 400, `free=maybe -> 400 (got ${badFree.status})`);

  const badRating = await call("/courses?minRating=9");
  ok(badRating.status === 400, `minRating=9 -> 400 (got ${badRating.status})`);

  const badTag = await call("/courses?tags=notanid");
  ok(badTag.status === 400, `tags=notanid -> 400 (got ${badTag.status})`);

  console.log("\n== /:courseId not shadowed ==");
  // Grab a real published course id to confirm the GET-by-id route still works.
  const one = await db.collection("courses").findOne({ status: "published", isDeleted: { $ne: true } });
  if (one) {
    const byId = await call(`/courses/${one._id}`);
    ok(byId.status === 200, `GET /courses/:id -> 200 (got ${byId.status})`);
  } else {
    console.log("  (skipping :courseId check — no published course found)");
  }

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
} catch (err) {
  console.error("Error:", err);
  await mongoose.disconnect();
  process.exit(1);
}
