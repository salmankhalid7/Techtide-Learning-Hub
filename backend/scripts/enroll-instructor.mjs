import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

const QUIZ_ID = "6a686c12a9a2d30b8da75a89";
const USER_ID = "6a606f73ceb4c35a209173c4"; // the instructor who created the quiz

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // 1. Find the quiz to get the course ID
  const quiz = await db.collection("quizzes").findOne(
    { _id: new mongoose.Types.ObjectId(QUIZ_ID) },
    { projection: { course: 1, title: 1 } }
  );

  if (!quiz) {
    console.error("Quiz not found.");
    process.exit(1);
  }

  console.log(`Quiz: ${quiz.title}`);
  console.log(`Course ID: ${quiz.course}`);

  // 2. Check if enrollment already exists
  const existing = await db.collection("enrollments").findOne({
    student: new mongoose.Types.ObjectId(USER_ID),
    course: quiz.course,
    status: "ACTIVE",
  });

  if (existing) {
    console.log("You are already enrolled in this course. No changes needed.");
    process.exit(0);
  }

  // 3. Create enrollment
  const result = await db.collection("enrollments").insertOne({
    student: new mongoose.Types.ObjectId(USER_ID),
    course: quiz.course,
    status: "ACTIVE",
    enrolledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log(`Enrollment created: ${result.insertedId}`);
  console.log("Done! You can now start quiz attempts.");
} catch (err) {
  console.error("Error:", err.message);
} finally {
  await mongoose.disconnect();
}
