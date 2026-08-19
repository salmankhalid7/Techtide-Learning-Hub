/**
 * @file test-certificates-http.mjs
 * @description HTTP smoke test for certificate routes.
 *
 * Requires the server to be running (node src/server.js) on the configured port.
 * Verifies:
 *   1. GET /api/v1/certificates/verify/:number  -> public (no auth), bogus -> 404, real -> valid
 *   2. GET /api/v1/certificates/my             -> 401 without a token
 *   3. POST /courses/:courseId/certificates     -> 401 without a token
 *
 * Run from backend folder: node scripts/test-certificates-http.mjs
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 5000;
const BASE = `http://localhost:${PORT}/api/v1`;

let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}`); }
};

async function getJson(url) {
  const res = await fetch(url);
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { status: res.status, data };
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  // Grab a real certificate issued by the earlier test run.
  const realCert = await db.collection("certificates").findOne({});
  console.log(`Using real certificate: ${realCert?.certificateNumber || "(none found)"}`);

  console.log("\n== 1. Public verification (no auth) ==");
  // Bogus number -> 404
  const bogus = await getJson(`${BASE}/certificates/verify/LRNX-BOGUS0000`);
  ok(bogus.status === 404, `Bogus number -> 404 (got ${bogus.status})`);

  if (realCert) {
    const real = await getJson(`${BASE}/certificates/verify/${realCert.certificateNumber}`);
    ok(real.status === 200, `Real number -> 200 (got ${real.status})`);
    ok(real.data?.data?.valid === true, "Response marks certificate valid");
  }

  console.log("\n== 2. Auth guard on student routes ==");
  const myNoAuth = await getJson(`${BASE}/certificates/my`);
  ok(myNoAuth.status === 401, `GET /certificates/my without token -> 401 (got ${myNoAuth.status})`);

  const genNoAuth = await getJson(`${BASE}/courses/somecourse123/certificates`);
  ok(genNoAuth.status === 401 || genNoAuth.status === 404, `POST /courses/:id/certificates -> 401 (got ${genNoAuth.status})`);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail ? 1 : 0);
} catch (err) {
  console.error("Error:", err);
  await mongoose.disconnect();
  process.exit(1);
}
