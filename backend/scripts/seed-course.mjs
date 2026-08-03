import mongoose from "mongoose";
import dotenv from "dotenv";

import courseService from "../src/services/course.service.js";
import { enrollStudent } from "../src/services/enrollment.service.js";

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

const title = process.argv[2] || "Node.js API Masterclass 2026";

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // 1. Find instructor + student
  const instructor = await db.collection("users").findOne({ role: "instructor" });
  if (!instructor) {
    console.error("No instructor user found. Create one first.");
    process.exit(1);
  }
  console.log("Instructor:", instructor._id.toString(), instructor.email);

  const student = await db.collection("users").findOne({ role: "student" });
  if (!student) {
    console.error("No student user found. Create one first.");
    process.exit(1);
  }
  console.log("Student:", student._id.toString(), student.email);

  // 2. Ensure a category exists
  let category = await db.collection("categories").findOne({});
  if (!category) {
    const ins = await db.collection("categories").insertOne({
      name: "Programming",
      slug: "programming",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    category = { _id: ins.insertedId };
  }
  console.log("Category:", category._id.toString());

  // 3. Create course (as instructor)
  const course = await courseService.createCourse(
    {
      title,
      shortDescription:
        "Build production-grade REST APIs with Express, MongoDB, and modern Node.js tooling.",
      description:
        "Learn to design, build, and deploy robust Node.js APIs. Covers Express routing, Mongoose schemas, authentication with JWT, validation, error handling, testing, and deployment to production — with hands-on projects throughout the course.",
      pricing: { price: 59.99 },
      courseLanguage: "English",
      category: category._id,
      thumbnail: {
        publicId: "seed/course-thumbnail",
        url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3",
      },
    },
    { _id: instructor._id, role: instructor.role }
  );
  console.log("Course created:", course._id.toString(), "| slug:", course.slug);

  // 4. Publish
  const published = await courseService.publishCourse(
    course._id,
    { _id: instructor._id, role: instructor.role }
  );
  console.log("Course published:", published.status);

  // 5. Enroll student
  const result = await enrollStudent({
    courseId: course._id,
    studentId: student._id,
  });
  console.log("Enrollment:", result.enrollment._id.toString());
  console.log("Progress:", result.progress._id.toString());

  console.log("\n=== ALL DONE ===");
  console.log("Course ID:  ", course._id.toString());
  console.log("Category ID:", category._id.toString());
  console.log("Student ID: ", student._id.toString());
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
