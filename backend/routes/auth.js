console.log("AUTH ROUTE LOADED");

const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../db");


// =====================
// REGISTER
// =====================
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.send("All fields required");
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'student')",
      [username, email, hashedPassword],
      (err) => {
        if (err) {
          console.log("REGISTER ERROR:", err);
          return res.send("User already exists");
        }

        res.send("Registration successful");
      }
    );
  } catch (error) {
    console.log("HASH ERROR:", error);
    res.send("Registration error");
  }
});


// =====================
// LOGIN (ROLE BASED)
// =====================
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email=?", [email], async (err, result) => {

    if (err || result.length === 0) {
      console.log("❌ USER NOT FOUND");
      return res.send("Invalid credentials");
    }

    const user = result[0];

    console.log("✅ LOGIN EMAIL:", user.email);
    console.log("✅ ROLE FROM DB:", user.role);

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      console.log("❌ WRONG PASSWORD");
      return res.send("Invalid credentials");
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    console.log("✅ SESSION SAVED:", req.session.user);

    if (user.role === "admin") {
      console.log("🚀 ADMIN REDIRECT TRIGGERED");
      return res.redirect("/admin");
    }

    console.log("📘 STUDENT REDIRECT TRIGGERED");
    return res.redirect("/dashboard");
  });
});

// =====================
// LOGOUT
// =====================
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});


module.exports = router;
