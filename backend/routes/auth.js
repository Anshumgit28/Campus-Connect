console.log("✅ AUTH ROUTE LOADED");
console.log("🔥 AUTH FILE EXECUTED");
const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const db = require("../db");
const rateLimit = require("express-rate-limit");


/* ======================
   LOGIN RATE LIMITER
====================== */
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: "Too many login attempts. Try again after 5 minutes."
});


/* =====================
   REGISTER
===================== */
router.post("/register", async (req, res) => {

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).send("All fields required");
  }

  try {

    //HASH PASSWORD
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
      "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'student')",
      [username, email, hashedPassword],
      (err) => {

        if (err) {
          console.log("❌ REGISTER ERROR:", err);
          return res.status(500).send("User already exists or DB error");
        }

        console.log("✅ USER REGISTERED:", email);

        res.redirect("/login.html");
      }
    );

  } catch (error) {

    console.log("❌ REGISTER CRASH:", error);
    res.status(500).send("Registration error");

  }
});


/* =====================
   LOGIN (SUPER STABLE)
===================== */
router.post("/login", loginLimiter, (req, res) => {

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send("Email and password required");
  }

  console.log("🔐 LOGIN ATTEMPT:", email);

  db.query(
    "SELECT * FROM users WHERE email=?",
    [email],
    async (err, result) => {

      if (err) {
        console.log("❌ DB ERROR:", err);
        return res.status(500).send("Server error");
      }

      if (result.length === 0) {
        console.log("❌ USER NOT FOUND");
        return res.status(401).send("Invalid credentials");
      }

      const user = result[0];

      try {

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
          console.log("❌ PASSWORD WRONG");
          return res.status(401).send("Invalid credentials");
        }

        /* =========================
           CREATE STRONG SESSION
        ========================= */

        req.session.user = {

          id: user.id,             
          email: user.email,       
          username: user.username,  
          role: user.role

        };

        /* =========================
           FORCE SESSION SAVE
        ========================= */

        req.session.save((err) => {

          if (err) {
            console.log("❌ SESSION SAVE ERROR:", err);
            return res.status(500).send("Session error");
          }

          console.log("✅ SESSION CREATED:", req.session.user);

          /* =====================
             ROLE REDIRECT
          ===================== */

          if (user.role === "admin") {
            console.log("➡ Redirecting to ADMIN dashboard");
            return res.redirect("/admin");
          }

          if (user.role === "alumni") {
            console.log("➡ Redirecting to ALUMNI dashboard");
            return res.redirect("/dashboards/alumni/alumni-dashboard.html");
          }

          console.log("➡ Redirecting to STUDENT dashboard");
          return res.redirect("/dashboard");

        });

      } catch (bcryptError) {

        console.log("❌ BCRYPT ERROR:", bcryptError);
        return res.status(500).send("Authentication error");

      }

    }
  );
});

/* =====================
   LOGOUT
===================== */
router.get("/logout", (req, res) => {

  req.session.destroy((err) => {

    if (err) {
      console.log("❌ LOGOUT ERROR:", err);
      return res.redirect("/dashboards/student/dashboard.html");

    }

    console.log("👋 USER LOGGED OUT");

    res.clearCookie("connect.sid"); 
    res.redirect("/login.html");

  });

});


module.exports = router; 
