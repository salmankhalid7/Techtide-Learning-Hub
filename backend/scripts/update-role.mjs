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

  const result = await db.collection("users").updateOne(
    { email: "t@example.com" },
    { $set: { role: "instructor" } }
  );

  if (result.matchedCount > 0) {
    console.log("User role updated to 'instructor'.");
  } else {
    console.log("User not found.");
  }
} catch (err) {
  console.error("Error:", err.message);
} finally {
  await mongoose.disconnect();
}
