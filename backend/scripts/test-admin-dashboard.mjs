/**
 * @file test-admin-dashboard.mjs
 * @description Quick smoke test for the admin dashboard endpoints.
 * Logs in as the admin user, captures the accessToken cookie, then hits the
 * composite admin dashboard and the individual admin analytics endpoints.
 */

const BASE = "http://localhost:5000/api/v1";

async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@test.com", password: "Admin@123" }),
  });

  const body = await res.json();
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const accessCookie = setCookie.find((c) => c.startsWith("accessToken="));
  if (!accessCookie) {
    console.error("Login OK but no accessToken cookie set.");
    console.error(JSON.stringify(setCookie, null, 2));
    process.exit(1);
  }
  // Extract just "accessToken=<value>"
  return { token: accessCookie.split(";")[0], status: res.status };
}

async function get(path, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: "GET",
    headers: { Cookie: token },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function main() {
  const { token } = await login();
  console.log("✅ Logged in as admin.\n");

  const endpoints = [
    ["/admin/dashboard", "Composite Admin Dashboard"],
    ["/admin/dashboard/overview", "Admin Overview"],
    ["/admin/dashboard/action-center", "Admin Action Center"],
    ["/admin/dashboard/recent-activity", "Recent Activity"],
    ["/admin/dashboard/platform-health", "Platform Health"],
    ["/admin/dashboard/users", "User Analytics"],
    ["/admin/dashboard/courses", "Course Analytics"],
    ["/admin/dashboard/enrollments", "Enrollment Analytics"],
    ["/admin/dashboard/revenue", "Revenue Analytics"],
  ];

  for (const [path, label] of endpoints) {
    const { status, body } = await get(path, token);
    const ok = status >= 200 && status < 300;
    console.log(`${ok ? "✅" : "❌"} ${label} -> ${status}`);
    if (!ok) {
      console.log(JSON.stringify(body, null, 2));
    } else {
      // Print a compact summary of the top-level keys/action types
      const data = body?.data;
      if (data && typeof data === "object") {
        console.log("   keys:", Object.keys(data).join(", "));
      } else if (Array.isArray(data)) {
        console.log("   array length:", data.length, "| types:", data.map((a) => a.type).join(", ") || "(empty)");
      }
    }
    console.log();
  }
}

main().catch((err) => {
  console.error("Test error:", err.message);
  process.exit(1);
});
