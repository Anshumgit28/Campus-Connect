const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const path = require("path");


/* =====================================================
   STUDENT DASHBOARD PAGE
===================================================== */
router.get("/", auth, (req, res) => {

  console.log("DASHBOARD ACCESS REQUEST BY:", req.session.user);

  if (req.session.user.role !== "student") {
    return res.redirect("/admin");
  }

  res.sendFile(path.join(__dirname, "../public/dashboards/student/dashboard.html"));
}); 



/* =====================================================
   STUDENT DASHBOARD MAIN DATA
===================================================== */
router.get("/data", auth, (req, res) => {

  const userId = req.session.user.id;

  const queries = {
    notices: "SELECT COUNT(*) AS count FROM notices",
    events: "SELECT COUNT(*) AS count FROM events",
    resources: "SELECT COUNT(*) AS count FROM resources",
    clubs: "SELECT COUNT(*) AS count FROM user_clubs WHERE user_id=?",

    activity: `
      SELECT activity
      FROM activity_log
      WHERE user_id=?
      ORDER BY created_at DESC
      LIMIT 5
    `,

    upcomingEvents: `
      SELECT title, event_date, event_time
      FROM events
      WHERE event_date >= CURDATE()
      ORDER BY event_date ASC
      LIMIT 5
    `,

    userProfile: `
    SELECT username, email, prn, class_name, division, current_year
    FROM users
    WHERE id=?
    `

  };

  db.query(queries.notices, (err, notices) => {
    db.query(queries.events, (err, events) => {
      db.query(queries.resources, (err, resources) => {
        db.query(queries.clubs, [userId], (err, clubs) => {
          db.query(queries.activity, [userId], (err, activity) => {
            db.query(queries.upcomingEvents, (err, upcomingEvents) => {
              db.query(queries.userProfile, [userId], (err, userData) => {

                const profile = userData?.[0] || {};

                res.json({
                  user: profile.username,
                  email: profile.email,

                  prn: profile.prn || "Not Added",
                  class_name: profile.class_name || "Not Added",
                  division: profile.division || "Not Added",
                  current_year: profile.current_year || "Not Added",

                  notices: notices?.[0]?.count || 0,
                  events: events?.[0]?.count || 0,
                  resources: resources?.[0]?.count || 0,
                  clubs: clubs?.[0]?.count || 0,

                  activity: activity || [],
                  upcomingEvents: upcomingEvents || []
                });

              });
            });
          });
        });
      });
    });
  });
});



/* =====================================================
   UPDATE STUDENT PROFILE (NEW ROUTE)
===================================================== */
router.post("/profile/update", auth, (req, res) => {

  console.log("📌 PROFILE UPDATE HIT");
  console.log(req.body);
  const userId = req.session.user.id;
  

  const {
  username,
  prn,
  class_name,
  division,
  current_year
} = req.body;


  // Basic validation
  if (!username) {
    return res.json({
      success:false,
      message:"Username required"
    });
  }

  db.query(
    `
    UPDATE users
    SET 
      username=?,
      prn=?,
      class_name=?,
      division=?,
      current_year=?
    WHERE id=?
    `,
    [
      username,
      prn,
      class_name,
      division,
      current_year,
      userId
    ],
    (err) => {

      if (err) {
        console.log("🔥 PROFILE UPDATE ERROR:", err);
        return res.json({ success:false });
      }

      console.log("✅ Student profile updated:", userId);

      res.json({ success:true });

    }
  );
});



/* =====================================================
   ACADEMIC MODULE
===================================================== */


/* ======================
   ATTENDANCE %
====================== */
router.get("/academic/attendance", auth, (req, res) => {

  console.log("🔥 LOGGED USER ID:", req.session.user.id);

  db.query(
    `
    SELECT ROUND(SUM(attended) / SUM(total) * 100) AS attendance
    FROM attendance
    WHERE user_id=?
    `,
    [req.session.user.id],
    (err, result) => {

      if (err || !result[0]?.attendance) {
        return res.json({ attendance: 0 });
      }

      res.json({ attendance: result[0].attendance });
    }
  );
});



/* ======================
   ASSIGNMENTS
====================== */
router.get("/academic/assignments", auth, (req, res) => {

  db.query(
    `
    SELECT title, due_date
    FROM assignments
    WHERE due_date >= CURDATE()
    ORDER BY due_date ASC
    `,
    (err, rows) => {

      if (err) {
        console.log("ASSIGNMENTS ERROR:", err);
        return res.json([]);
      }

      res.json(rows);
    }
  );
});



/* ======================
   EXAMS
====================== */
router.get("/academic/exams", auth, (req, res) => {

  db.query(
    `
    SELECT subject, exam_date
    FROM exams
    WHERE user_id=? AND exam_date >= CURDATE()
    ORDER BY exam_date ASC
    `,
    [req.session.user.id],
    (err, rows) => {

      if (err) return res.json([]);
      res.json(rows);
    }
  );
});



/* ======================
   GRADES
====================== */
router.get("/academic/grades", auth, (req, res) => {

  db.query(
    `
    SELECT subject, grade
    FROM grades
    WHERE user_id=?
    `,
    [req.session.user.id],
    (err, rows) => {

      if (err) return res.json([]);
      res.json(rows);
    }
  );
});



/* ======================
   PERFORMANCE SUMMARY
====================== */
router.get("/academic/performance", auth, (req, res) => {

  db.query(
    `
    SELECT grade
    FROM grades
    WHERE user_id=?
    `,
    [req.session.user.id],
    (err, rows) => {

      if (err || rows.length === 0) {
        return res.json({ performance: "N/A" });
      }

      const scoreMap = { A: 4, B: 3, C: 2, D: 1 };
      let total = 0;

      rows.forEach(r => {
        total += scoreMap[r.grade] || 0;
      });

      const gpa = (total / rows.length).toFixed(2);

      res.json({
        performance: gpa >= 3.5 ? "Excellent"
                   : gpa >= 2.5 ? "Good"
                   : "Needs Improvement",
        gpa
      });
    }
  );
});


module.exports = router;
