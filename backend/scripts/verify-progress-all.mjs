import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const BASE = "http://localhost:5000/api/v1";
const LESSON = "6a72e5879bc50a4d9d4b826b";
const MODULE = "6a72e5869bc50a4d9d4b826a";
const COURSE = "6a72e5859bc50a4d9d4b8269";
const STUDENT = "6a5f46581a2ce28af604a6e9"; // salman1@example.com

const token = jwt.sign(
  { id: STUDENT },
  process.env.JWT_ACCESS_SECRET,
  { expiresIn: process.env.JWT_ACCESS_EXPIRES }
);

async function call(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `accessToken=${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  console.log(`\n${method} ${url}`);
  console.log("  HTTP", res.status, "| success:", data.success, "| msg:", data.message);
  if (data.errors && data.errors.length) console.log("  errors:", JSON.stringify(data.errors));
  if (data.data) console.log("  data:", JSON.stringify(data.data).slice(0, 600));
}

// GETs first (enrollment must stay ACTIVE), PATCH last (completes the course)
await call("GET", `${BASE}/lessons/${LESSON}/progress`);
await call("GET", `${BASE}/modules/${MODULE}/progress`);
await call("GET", `${BASE}/courses/${COURSE}/progress`);
await call("GET", `${BASE}/courses/${COURSE}/resume`);
await call("PATCH", `${BASE}/lessons/${LESSON}/progress`, { isCompleted: true, timeSpent: 60 });
