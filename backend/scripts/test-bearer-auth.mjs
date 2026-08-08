/**
 * @file test-bearer-auth.mjs
 * @description Verify the new Bearer token auth path works end-to-end.
 * Logs in as admin, extracts the accessToken from the response body, then calls
 * the admin dashboard using ONLY an Authorization: Bearer header (no cookies).
 */

const BASE = "http://localhost:5000/api/v1";

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", password: "Admin@123" }),
  });
  const body = await res.json();
  const token = body?.data?.accessToken;
  if (!token) {
    console.error("❌ No accessToken in login response body.");
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }
  console.log("✅ Login returned accessToken in body.");
  return token;
}

async function getWithBearer(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status };
}

async function main() {
  const token = await login();

  console.log("Testing Bearer auth (no cookies) against admin endpoints:\n");

  const endpoints = [
    "/admin/dashboard",
    "/admin/dashboard/overview",
    "/admin/dashboard/action-center",
  ];

  let allOk = true;
  for (const path of endpoints) {
    const { status } = await getWithBearer(path, token);
    const ok = status >= 200 && status < 300;
    if (!ok) allOk = false;
    console.log(`${ok ? "✅" : "❌"} Bearer ${path} -> ${status}`);
  }

  // Also confirm a bad token is rejected.
  const bad = await getWithBearer("/admin/dashboard", "invalid.token.here");
  console.log(`\nBad token check -> ${bad.status} (${bad.status === 401 ? "✅ correctly 401" : "❌"})`);
  if (bad.status !== 401) allOk = false;

  console.log(allOk ? "\n✅ All Bearer auth tests passed." : "\n⚠️ Some tests failed.");
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error("Test error:", err.message);
  process.exit(1);
});
