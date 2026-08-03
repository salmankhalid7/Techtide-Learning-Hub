import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

const categoryName = process.argv[2] || "Web Development";

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const existing = await db.collection("categories").findOne({
    name: { $regex: new RegExp(`^${categoryName}$`, "i") },
  });

  if (existing) {
    console.log("Category already exists with _id:", existing._id.toString());
    process.exit(0);
  }

  const result = await db.collection("categories").insertOne({
    name: categoryName,
    slug: categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log("Category created with _id:", result.insertedId.toString());
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
