import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

const lessonId = process.argv[2] || "6a65f2d395e68d2c200d736c";

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const lesson = await db
    .collection("lessons")
    .findOne({ _id: new mongoose.Types.ObjectId(lessonId) });

  if (!lesson) {
    console.log("Lesson not found in DB:", lessonId);
    process.exit(0);
  }

  console.log("title:", lesson.title);
  console.log("lessonType:", lesson.lessonType);
  console.log("status:", lesson.status);
  console.log("isDeleted:", lesson.isDeleted);
  console.log("module:", lesson.module?.toString());
  console.log("content:", JSON.stringify(lesson.content, null, 2));
  console.log("top-level keys:", Object.keys(lesson));
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
