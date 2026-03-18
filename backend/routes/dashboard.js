"use strict";

const express = require("express");
const router  = express.Router();
const db      = require("../db");
const path    = require("path");
const auth    = require("../middleware/authMiddleware");

function studentOnly(req, res, next) {
  if (req.session?.user?.role !== "student") {
    if (req.headers.accept?.includes("application/json"))
      return res.status(403).json({ error: "Student access only" });
    return res.redirect("/login.html");
  }
  next();
}

router.use(auth, studentOnly);

router.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/student/dashboard.html"))
);

/* ── DASHBOARD DATA ── */
router.get("/data", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [[user]] = await db.promise().query(
      "SELECT username, email, prn, class_name, division, current_year FROM users WHERE id = ?",
      [uid]
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    let notices = { count: 0 }, events = { count: 0 }, 
        resources = { count: 0 }, clubs = { count: 0 };
    let activity = [];

    try {
      [[notices]] = await db.promise().query("SELECT COUNT(*) AS count FROM notices");
    } catch(_) {}
    try {
      [[events]] = await db.promise().query("SELECT COUNT(*) AS count FROM events WHERE event_date >= CURDATE()");
    } catch(_) {}
    try {
      [[resources]] = await db.promise().query("SELECT COUNT(*) AS count FROM resources");
    } catch(_) {}
    try {
      [[clubs]] = await db.promise().query(
        "SELECT COUNT(*) AS count FROM user_clubs WHERE user_id=? AND status='approved'", [uid]);
    } catch(_) {}
    try {
      [activity] = await db.promise().query(
        "SELECT activity, created_at FROM activity_log WHERE user_id=? ORDER BY created_at DESC LIMIT 5", [uid]);
    } catch(_) {}

    return res.json({
      user: user.username, email: user.email,
      prn: user.prn || "", class_name: user.class_name || "",
      division: user.division || "", current_year: user.current_year || "",
      notices: notices.count, events: events.count,
      resources: resources.count, clubs: clubs.count, activity
    });
  } catch (err) {
    console.error("Dashboard data error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ── PROFILE UPDATE ── */
async function doProfileUpdate(req, res) {
  const uid          = req.session.user.id;
  const username     = (req.body.username     || "").trim().slice(0, 100);
  const prn          = (req.body.prn          || "").trim().slice(0, 20)  || null;
  const class_name   = (req.body.class_name   || "").trim().slice(0, 50)  || null;
  const division     = (req.body.division     || "").trim().slice(0, 10)  || null;
  const current_year = (req.body.current_year || "").trim()               || null;

  if (!username || username.length < 2)
    return res.json({ success: false, message: "Name must be at least 2 characters" });

  try {
    try {
      await db.promise().query(
        "UPDATE users SET username=?, prn=?, class_name=?, division=?, current_year=?, updated_at=NOW() WHERE id=?",
        [username, prn, class_name, division, current_year, uid]
      );
    } catch (_) {
      await db.promise().query(
        "UPDATE users SET username=?, prn=?, class_name=?, division=?, current_year=? WHERE id=?",
        [username, prn, class_name, division, current_year, uid]
      );
    }

    req.session.user.username = username;

    try {
      await db.promise().query(
        "INSERT INTO activity_log (user_id, activity) VALUES (?, 'Updated profile')", [uid]
      );
    } catch (_) {}

    return res.json({ success: true });
  } catch (err) {
    console.error("Profile update error:", err.message);
    return res.status(500).json({ success: false, message: "Update failed: " + err.message });
  }
}

router.post("/profile/update", doProfileUpdate);
router.put("/profile",         doProfileUpdate);

/* ── ACADEMICS ── */
router.get("/academic/attendance", async (req, res) => {
  const uid = req.session.user.id;
  try {
    // Try new session-based attendance first
    let percentage = 0;
    try {
      const [[r]] = await db.promise().query(
        `SELECT 
           COUNT(s.id) AS total_sessions,
           SUM(CASE WHEN ar.status IN ('present','late') THEN 1 ELSE 0 END) AS attended
         FROM course_enrollments ce
         JOIN attendance_sessions s ON s.course_id = ce.course_id AND s.batch_id = ce.batch_id
         LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = ?
         WHERE ce.student_id = ?`,
        [uid, uid]
      );
      if (r.total_sessions > 0) {
        percentage = Math.round((r.attended / r.total_sessions) * 100);
      }
    } catch(_) {}

    // Fallback to legacy attendance table
    if (percentage === 0) {
      try {
        const [[r]] = await db.promise().query(
          "SELECT COALESCE(ROUND(SUM(attended)*100.0/NULLIF(SUM(total),0),2),0) AS percentage FROM attendance WHERE user_id=? AND total > 0",
          [uid]
        );
        percentage = parseFloat(r.percentage) || 0;
      } catch(_) {}
    }

    res.json({ attendance: percentage });
  } catch (err) { 
    res.status(500).json({ attendance: 0 }); 
  }
});

router.get("/academic/assignments", async (req, res) => {
  const uid = req.session.user.id;
  try {
    // Try to get assignments from enrolled courses first
    let rows = [];
    try {
      [rows] = await db.promise().query(
        `SELECT a.id, a.title, a.subject, a.description, a.due_date
         FROM assignments a
         JOIN course_enrollments ce ON ce.course_id = a.course_id
         WHERE ce.student_id = ? AND a.due_date >= CURDATE()
         ORDER BY a.due_date ASC LIMIT 10`,
        [uid]
      );
    } catch(_) {}

    // Fallback: all upcoming assignments
    if (!rows.length) {
      try {
        [rows] = await db.promise().query(
          "SELECT id, title, subject, description, due_date FROM assignments WHERE due_date >= CURDATE() ORDER BY due_date ASC LIMIT 10"
        );
      } catch(_) {}
    }

    res.json(rows);
  } catch (err) { 
    res.status(500).json([]); 
  }
});

router.get("/academic/exams", async (req, res) => {
  const uid = req.session.user.id;
  try {
    let rows = [];
    try {
      [rows] = await db.promise().query(
        "SELECT id, subject, exam_date, exam_type FROM exams WHERE exam_date >= CURDATE() ORDER BY exam_date ASC LIMIT 10"
      );
    } catch(_) {}
    res.json(rows);
  } catch (err) { 
    res.status(500).json([]); 
  }
});

router.get("/academic/grades", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [rows] = await db.promise().query(
      "SELECT id, subject, grade FROM grades WHERE user_id=? ORDER BY id DESC", [uid]
    );
    res.json(rows);
  } catch (err) { 
    res.status(500).json([]); 
  }
});

router.get("/academic/performance", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [rows] = await db.promise().query("SELECT grade FROM grades WHERE user_id=?", [uid]);
    if (!rows.length) return res.json({ performance: "N/A", gpa: "0.00" });
    const pts = { A: 4, B: 3, C: 2, D: 1, F: 0 };
    const gpa = (rows.reduce((s, r) => s + (pts[r.grade] || 0), 0) / rows.length).toFixed(2);
    const performance = gpa >= 3.5 ? "Excellent" : gpa >= 2.5 ? "Good" : gpa >= 1.5 ? "Average" : "Needs Improvement";
    res.json({ performance, gpa });
  } catch (err) { 
    res.status(500).json({ performance: "N/A", gpa: "0.00" }); 
  }
});

module.exports = router;