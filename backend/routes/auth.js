"use strict";

console.log("✅ AUTH ROUTE LOADED");

const express   = require("express");
const router    = express.Router();
const bcrypt    = require("bcrypt");
const db        = require("../db");
const rateLimit = require("express-rate-limit");

/* ── Strict rate limiter for login endpoint ── */
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 5 minutes." }
});

/* ─────────────────────────────────────────
   REGISTER
───────────────────────────────────────── */
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username?.trim() || !email?.trim() || !password?.trim()) {
    return res.status(400).send("All fields are required");
  }
  if (password.length < 6) {
    return res.status(400).send("Password must be at least 6 characters");
  }

  try {
    const hashed = await bcrypt.hash(password, 12); // cost 12 is production standard

    await db.promise().query(
      "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'student')",
      [username.trim(), email.trim().toLowerCase(), hashed]
    );

    console.log("✅ USER REGISTERED:", email);
    return res.redirect("/login.html");

  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") {
      return res.status(400).send("Email already registered. Please log in.");
    }
    console.error("❌ REGISTER ERROR:", e.message);
    return res.status(500).send("Registration failed. Please try again.");
  }
});

/* ─────────────────────────────────────────
   LOGIN
───────────────────────────────────────── */
router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim() || !password?.trim()) {
    return res.status(400).send("Email and password are required");
  }

  console.log("🔐 LOGIN ATTEMPT:", email);

  try {
    const [result] = await db.promise().query(
      "SELECT * FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );

    if (!result.length) {
      return res.status(401).send("Invalid email or password");
    }

    const user = result[0];

    // Block inactive accounts
    if (user.is_active === 0) {
      return res.status(403).send("Account is deactivated. Contact admin.");
    }

    // Verify password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).send("Invalid email or password");
    }

    // Store session
    req.session.user = {
      id:       user.id,
      email:    user.email,
      username: user.username,
      role:     user.role
    };

    // Save session BEFORE redirect — prevents race condition
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error("❌ SESSION SAVE ERROR:", saveErr);
        return res.status(500).send("Login failed — session error. Try again.");
      }

      console.log("✅ SESSION CREATED:", req.session.user);

      // Log activity (fire-and-forget — don't block redirect)
      db.promise().query(
        "INSERT INTO activity_log (user_id, activity) VALUES (?, ?)",
        [user.id, "Logged in"]
      ).catch(err => console.error("Activity log error:", err));

      // Role-based redirect
      const redirectMap = {
        admin:     "/admin",
        alumni:    "/alumni/dashboard",
        faculty:   "/faculty/",
        club_head: "/club/"
      };

      return res.redirect(redirectMap[user.role] || "/dashboard");
    });

  } catch (e) {
    console.error("❌ LOGIN ERROR:", e.message);
    return res.status(500).send("Login failed. Please try again.");
  }
});

/* ─────────────────────────────────────────
   LOGOUT
───────────────────────────────────────── */
router.get("/logout", (req, res) => {
  const uid = req.session?.user?.id;

  if (uid) {
    db.promise().query(
      "INSERT INTO activity_log (user_id, activity) VALUES (?, ?)",
      [uid, "Logged out"]
    ).catch(err => console.error("Logout log error:", err));
  }

  req.session.destroy((err) => {
    if (err) console.error("❌ LOGOUT SESSION DESTROY ERROR:", err);
    res.clearCookie("campus_connect.sid");
    return res.redirect("/login.html");
  });
});

module.exports = router;