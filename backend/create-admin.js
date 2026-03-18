// Run this once: node create-admin.js
// Place this file in your backend/ folder and run it

require("dotenv").config();
const bcrypt = require("bcrypt");
const db = require("./db");

async function createAdmin() {
  const email    = "admin@campus.com";   // ← change if needed
  const password = "admin123";           // ← change to your desired password
  const username = "Admin";

  try {
    const hashed = await bcrypt.hash(password, 12);

    // Check if already exists
    const [[existing]] = await db.promise().query(
      "SELECT id FROM users WHERE email = ?", [email]
    );

    if (existing) {
      // Update existing user to admin
      await db.promise().query(
        "UPDATE users SET role='admin', status='active', password=? WHERE email=?",
        [hashed, email]
      );
      console.log(`✅ Updated existing user ${email} → role: admin`);
    } else {
      // Create new admin user
      await db.promise().query(
        "INSERT INTO users (username, email, password, role, status) VALUES (?,?,?,'admin','active')",
        [username, email, hashed]
      );
      console.log(`✅ Admin created: ${email} / ${password}`);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

createAdmin();