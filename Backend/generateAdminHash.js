import crypto from "crypto";
import mongoose from "mongoose";
import Admin from "./database/models/admin.model.js";
import dotenv from "dotenv";

dotenv.config();

const password = "Bahati001";
const email = "brianoduor03@gmail.com";
const name = "System Admin";

const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(password, salt, 64).toString("hex");
const token = crypto.randomBytes(48).toString("hex");
const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

console.log("=== First Admin Bootstrap ===\n");
console.log(`Name: ${name}`);
console.log(`Email: ${email}`);
console.log(`Password: ${password}`);
console.log(`Salt: ${salt}`);
console.log(`Hash: ${hash}`);
console.log(`\nToken: ${token}`);
console.log(`Token Hash: ${tokenHash}`);

// Connect to MongoDB and insert
async function bootstrap() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/betsave";
    await mongoose.connect(mongoUri);
    console.log("\n✓ Connected to MongoDB");

    // Check if admin already exists
    const existing = await Admin.findOne({ email });
    if (existing) {
      console.log(`\n⚠️  Admin with email ${email} already exists!`);
      console.log("Use a different email or delete the existing admin first.");
      await mongoose.disconnect();
      return;
    }

    // Create admin
    const admin = await Admin.create({
      name,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      status: "ACTIVE",
      apiTokenHash: tokenHash,
      apiTokenIssuedAt: new Date(),
      lastLoginAt: new Date()
    });

    console.log("\n✓ Admin created successfully!");
    console.log(`\nAdmin ID: ${admin._id}`);
    console.log(`\n📝 Login with:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`\n🔑 Admin Token (for API calls):`);
    console.log(`   ${token}`);

    await mongoose.disconnect();
    console.log("\n✓ Disconnected from MongoDB");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

bootstrap();