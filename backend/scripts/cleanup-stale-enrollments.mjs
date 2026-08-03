import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const activeEnrollments = await db
    .collection("enrollments")
    .find({ status: "ACTIVE" })
    .toArray();

  let removed = 0;

  for (const enrollment of activeEnrollments) {
    const course = await db
      .collection("courses")
      .findOne({ _id: enrollment.course });

    const isPublished = course?.status === "published" && !course?.isDeleted;

    if (!isPublished) {
      // Delete the stale enrollment + its progress doc
      await db.collection("enrollments").deleteOne({ _id: enrollment._id });
      await db.collection("progress").deleteMany({ enrollment: enrollment._id });

      // Decrement the course counter (floor at 0)
      if (course) {
        await db.collection("courses").updateOne(
          { _id: course._id },
          [
            {
              $set: {
                "statistics.totalEnrollments": {
                  $max: [
                    { $subtract: ["$statistics.totalEnrollments", 1] },
                    0,
                  ],
                },
              },
            },
          ]
        );
      }

      console.log(
        `Removed stale ACTIVE enrollment ${enrollment._id} for course ${enrollment.course} (${course?.status ?? "missing"})`
      );
      removed += 1;
    }
  }

  console.log(`Done. Removed ${removed} stale enrollment(s).`);
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
