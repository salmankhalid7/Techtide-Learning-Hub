import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const courseId = process.argv[2] || "6a72e615bb8b07b73791d4c1";

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const oid = new mongoose.Types.ObjectId(courseId);

  const enrollments = await db.collection("enrollments").find({ course: oid }).toArray();
  for (const e of enrollments) {
    const user = await db.collection("users").findOne({ _id: e.student }, { projection: { email: 1 } });
    const progress = await db.collection("progresses").findOne({ enrollment: e._id });
    console.log("Enrollment:", e._id.toString(), "| status:", e.status, "| user:", user?.email);
    if (progress) {
      console.log("  progress:", progress._id.toString(),
        "| pct:", progress.completionPercentage,
        "| isCourseCompleted:", progress.isCourseCompleted,
        "| completedAt:", progress.completedAt,
        "| completedLessons:", progress.completedLessons.length);
    }
  }
} catch (err) {
  console.error("Error:", err);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
