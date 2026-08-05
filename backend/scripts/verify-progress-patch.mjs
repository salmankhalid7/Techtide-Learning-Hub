import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const lessonId = process.argv[2] || "6a72e253513997eec70734dd";
const studentId = process.argv[3] || "6a5f46581a2ce28af604a6e9"; // salman1@example.com
const completed = process.argv[4] === "false" ? false : true;

const token = jwt.sign(
  { id: studentId },
  process.env.JWT_ACCESS_SECRET,
  { expiresIn: process.env.JWT_ACCESS_EXPIRES }
);

const res = await fetch(
  `http://localhost:5000/api/v1/lessons/${lessonId}/progress`,
  {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: `accessToken=${token}`,
    },
    body: JSON.stringify({ isCompleted: completed, timeSpent: 120 }),
  }
);

const data = await res.json();
console.log("HTTP", res.status);
console.log(JSON.stringify(data, null, 2));
