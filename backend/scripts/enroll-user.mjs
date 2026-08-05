import mongoose from "mongoose";
import dotenv from "dotenv";

import { enrollStudent } from "../src/services/enrollment.service.js";

dotenv.config();

const email = process.argv[2] || "t@example.com";
const courseId = process.argv[3] || "6a72e615bb8b07b73791d4c1";

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const user = await db.collection("users").findOne({ email });
  if (!user) {
    console.error("User not found:", email);
    process.exit(1);
  }
  console.log("User:", user._id.toString(), "|", user.email, "| role:", user.role);

  const result = await enrollStudent({
    courseId,
    studentId: user._id,
  });

  console.log("Enrolled successfully.");
  console.log("Enrollment:", result.enrollment._id.toString());
  console.log("Progress  :", result.progress._id.toString());
  console.log("Course    :", courseId);
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
