import mongoose from "mongoose";
import dotenv from "dotenv";

import User from "../src/models/user.model.js";

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set in .env");
  process.exit(1);
}

const email = "admin@test.com";
const password = "Admin@123";

try {
  await mongoose.connect(uri);

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Admin already exists: ${existing.email} (role=${existing.role})`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const admin = await User.create({
    fullName: "Platform Admin",
    username: "admin",
    email,
    password,
    role: "admin",
    isActive: true,
    isBlocked: false,
    isEmailVerified: true,
  });

  console.log("Admin user created:");
  console.log(JSON.stringify({
    email: admin.email,
    username: admin.username,
    role: admin.role,
    isActive: admin.isActive,
    isEmailVerified: admin.isEmailVerified,
  }, null, 2));
} catch (err) {
  console.error("Error:", err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
