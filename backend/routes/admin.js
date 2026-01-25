const express = require("express");
const router = express.Router();
const db = require("../db");
const path = require("path");

const auth = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");


// ======================
// ADMIN DASHBOARD PAGE
// ======================
router.get("/admin", auth, adminOnly, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/admin.html"));
});


// ======================
// CREATE NOTICE
// ======================
router.post("/admin/notice", auth, adminOnly, (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.send("Notice title required");
  }

  db.query(
    "INSERT INTO notices (title) VALUES (?)",
    [title],
    (err) => {
      if (err) {
        return res.send("Error adding notice");
      }
      res.redirect("/admin");
    }
  );
});


// ======================
// CREATE EVENT
// ======================
router.post("/admin/event", auth, adminOnly, (req, res) => {
  const { title, event_date } = req.body;

  if (!title || !event_date) {
    return res.send("All fields required");
  }

  db.query(
    "INSERT INTO events (title, event_date) VALUES (?, ?)",
    [title, event_date],
    (err) => {
      if (err) {
        return res.send("Error creating event");
      }
      res.redirect("/admin");
    }
  );
});


// ======================
// ADD CLUB
// ======================
router.post("/admin/club", auth, adminOnly, (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.send("Club name required");
  }

  db.query(
    "INSERT INTO clubs (name) VALUES (?)",
    [name],
    (err) => {
      if (err) {
        return res.send("Error adding club");
      }
      res.redirect("/admin");
    }
  );
});

module.exports = router;
