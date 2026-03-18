"use strict";

console.log("✅ AUTH ROUTE LOADED");

const express   = require("express");
const router    = express.Router();
const bcrypt    = require("bcrypt");
const db        = require("../db");
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 5 minutes." }
});

/* ── REGISTER ── */
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username?.trim() || !email?.trim() || !password?.trim())
    return res.status(400).send("All fields are required");
  if (password.length < 6)
    return res.status(400).send("Password must be at least 6 characters");
  try {
    const hashed = await bcrypt.hash(password, 12);
    await db.promise().query(
      "INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, 'student', 'active')",
      [username.trim(), email.trim().toLowerCase(), hashed]
    );
    console.log("✅ USER REGISTERED:", email);
    return res.redirect("/login.html");
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY")
      return res.status(400).send("Email already registered. Please log in.");
    console.error("❌ REGISTER ERROR:", e.message);
    return res.status(500).send("Registration failed. Please try again.");
  }
});

/* ── LOGIN ── */
router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email?.trim() || !password?.trim())
    return res.status(400).send("Email and password are required");

  console.log("🔐 LOGIN ATTEMPT:", email);

  try {
    const [result] = await db.promise().query(
      "SELECT * FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    );

    if (!result.length)
      return res.status(401).send("Invalid email or password");

    const user = result[0];

    /* Only block if status is explicitly 'inactive'
       NULL, 'active', or any other value = allowed in */
    if (user.status === "inactive")
      return res.status(403).send("Account is deactivated. Contact admin.");

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).send("Invalid email or password");

    req.session.user = {
      id:       user.id,
      email:    user.email,
      username: user.username,
      role:     user.role
    };

    req.session.save((saveErr) => {
      if (saveErr) {
        console.error("❌ SESSION SAVE ERROR:", saveErr);
        return res.status(500).send("Login failed — session error. Try again.");
      }

      console.log("✅ SESSION CREATED:", req.session.user);

      db.promise().query(
        "INSERT INTO activity_log (user_id, activity) VALUES (?, ?)",
        [user.id, "Logged in"]
      ).catch(err => console.error("Activity log error:", err));

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

/* ── LOGOUT ── */
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