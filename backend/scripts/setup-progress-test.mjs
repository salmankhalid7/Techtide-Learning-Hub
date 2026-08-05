import mongoose from "mongoose";
import dotenv from "dotenv";

import courseService from "../src/services/course.service.js";
import { createModule, publishModule } from "../src/services/module.service.js";
import { createLesson, publishLesson } from "../src/services/lesson.service.js";
import { enrollStudent } from "../src/services/enrollment.service.js";

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

const title = process.argv[2] || `Progress Test Course ${Date.now()}`;

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // 1. Find an instructor + student
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

  const instructorAuth = { _id: instructor._id, role: instructor.role };

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

  // 3. Course
  const course = await courseService.createCourse(
    {
      title,
      shortDescription: "Progress endpoint end-to-end test course.",
      description:
        "Test course used to verify PATCH /api/v1/lessons/:lessonId/progress.",
      pricing: { price: 19.99 },
      courseLanguage: "English",
      category: category._id,
      thumbnail: {
        publicId: "seed/progress-test",
        url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3",
      },
    },
    instructorAuth
  );
  console.log("Course created:", course._id.toString(), "| slug:", course.slug);

  await courseService.publishCourse(course._id, instructorAuth);
  console.log("Course published.");

  // 4. Module
  const module = await createModule(
    {
      course: course._id,
      title: "Module 1: Getting Started",
      description: "First module for progress testing.",
      isPreview: true,
    },
    instructorAuth
  );
  console.log("Module created:", module._id.toString());

  await publishModule(module._id, instructorAuth);
  console.log("Module published.");

  // 5. Lesson (VIDEO)
  const lesson = await createLesson(
    {
      module: module._id,
      title: "Lesson 1: Introduction",
      description: "Intro video lesson for progress testing.",
      lessonType: "VIDEO",
      content: {
        type: "VIDEO",
        video: {
          url: "https://example.com/progress-test.mp4",
          duration: 300,
          provider: "YOUTUBE",
          allowDownload: false,
        },
      },
      duration: 300,
      isPreview: true,
      isLocked: false,
    },
    instructorAuth
  );
  console.log("Lesson created:", lesson._id.toString());

  const publishedLesson = await publishLesson(lesson._id, instructorAuth);
  console.log("Lesson published:", publishedLesson.status);

  // 6. Enroll the student (creates the Progress doc too)
  const result = await enrollStudent({
    courseId: course._id,
    studentId: student._id,
  });
  console.log("Enrollment:", result.enrollment._id.toString());
  console.log("Progress:", result.progress._id.toString());

  console.log("\n=== READY ===");
  console.log("Course ID :", course._id.toString());
  console.log("Module ID :", module._id.toString());
  console.log("Lesson ID :", lesson._id.toString());
  console.log("Student   :", student.email);
  console.log("");
  console.log("PATCH http://localhost:5000/api/v1/lessons/" + lesson._id.toString() + "/progress");
  console.log("Content-Type: application/json");
  console.log("Authorization: Bearer <student token for " + student.email + ">");
  console.log('Body: { "isCompleted": true }');
} catch (err) {
  console.error("Error:", err);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
