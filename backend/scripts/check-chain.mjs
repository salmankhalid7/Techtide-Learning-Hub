import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const courseId = process.argv[2] || "6a72e615bb8b07b73791d4c1";

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const enrollments = await db
    .collection("enrollments")
    .find({ course: new mongoose.Types.ObjectId(courseId) })
    .toArray();

  console.log("Enrollments for course", courseId, ":", enrollments.length);
  for (const e of enrollments) {
    const student = await db
      .collection("users")
      .findOne({ _id: e.student }, { projection: { email: 1 } });
    console.log("-", e._id.toString(), "| status:", e.status, "| student:", e.student.toString(), student?.email);
  }

  const progress = await db
    .collection("progresses")
    .findOne({ course: new mongoose.Types.ObjectId(courseId) });
  console.log("Progress doc:", progress ? progress._id.toString() : null, "| pct:", progress?.completionPercentage);
} catch (err) {
  console.error("Error:", err);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
