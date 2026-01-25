const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const path = require("path");

// ======================
// STUDENT DASHBOARD PAGE
// ======================
router.get("/dashboard", auth, (req, res) => {

  console.log("DASHBOARD ACCESS REQUEST BY:", req.session.user);

  // BLOCK ADMIN FROM STUDENT DASHBOARD
  if (req.session.user.role !== "student") {
    console.log("ADMIN BLOCKED → REDIRECTING TO ADMIN");
    return res.redirect("/admin");
  }

  // SEND DASHBOARD HTML PAGE
  res.sendFile(path.join(__dirname, "../public/dashboard.html"));
});


// ======================
// STUDENT DASHBOARD DATA API
// ======================
router.get("/dashboard/data", auth, (req, res) => {

  const userId = req.session.user.id;

  const queries = {
    notices: "SELECT COUNT(*) AS count FROM notices",
    events: "SELECT COUNT(*) AS count FROM events",
    resources: "SELECT COUNT(*) AS count FROM resources",
    clubs: "SELECT COUNT(*) AS count FROM user_clubs WHERE user_id=?",
    activity: "SELECT activity FROM activity_log WHERE user_id=? ORDER BY created_at DESC LIMIT 5",
    upcomingEvents: "SELECT title, event_date FROM events ORDER BY event_date ASC LIMIT 3"
  };

  db.query(queries.notices, (err, notices) => {
    db.query(queries.events, (err, events) => {
      db.query(queries.resources, (err, resources) => {
        db.query(queries.clubs, [userId], (err, clubs) => {
          db.query(queries.activity, [userId], (err, activity) => {
            db.query(queries.upcomingEvents, (err, upcomingEvents) => {

              console.log("DASHBOARD DATA SENT TO STUDENT");

              res.json({
                user: req.session.user.username,
                notices: notices[0].count,
                events: events[0].count,
                resources: resources[0].count,
                clubs: clubs[0].count,
                activity,
                upcomingEvents
              });
            });
          });
        });
      });
    });
  });
});

module.exports = router;
