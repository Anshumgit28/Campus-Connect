const express = require("express");
const router = express.Router();
const db = require("../db");
const path = require("path");
const auth = require("../middleware/authMiddleware");

/* ── PAGES ── */
router.get("/", auth, (req, res) => {
  if (req.session.user.role !== "student")
    return res.redirect("/" + req.session.user.role.replace("_","-"));
  res.sendFile(path.join(__dirname, "../public/dashboards/student/dashboard.html"));
});

/* ── DASHBOARD DATA ── */
router.get("/data", auth, async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [[notices]] = await db.promise().query("SELECT COUNT(*) c FROM notices WHERE type='global'");
    const [[events]] = await db.promise().query("SELECT COUNT(*) c FROM events WHERE event_date>=CURDATE()");
    const [[resources]] = await db.promise().query("SELECT COUNT(*) c FROM resources");
    const [[clubs]] = await db.promise().query(
      "SELECT COUNT(*) c FROM user_clubs WHERE user_id=? AND status='approved'", [uid]);
    const [activity] = await db.promise().query(
      "SELECT activity FROM activity_log WHERE user_id=? ORDER BY created_at DESC LIMIT 5", [uid]);
    const [upcoming] = await db.promise().query(
      "SELECT title,event_date FROM events WHERE event_date>=CURDATE() ORDER BY event_date ASC LIMIT 5");
    const [[profile]] = await db.promise().query(
      "SELECT username,email,prn,class_name,division,current_year FROM users WHERE id=?", [uid]);
    res.json({
      user: profile?.username,
      email: profile?.email,
      prn: profile?.prn || "Not Added",
      class_name: profile?.class_name || "Not Added",
      division: profile?.division || "Not Added",
      current_year: profile?.current_year || "Not Added",
      notices: notices.c,
      events: events.c,
      resources: resources.c,
      clubs: clubs.c,
      activity,
      upcomingEvents: upcoming
    });
  } catch (e) { console.error(e); res.json({}); }
});

/* ── UPDATE PROFILE ── */
router.post("/profile/update", auth, async (req, res) => {
  const { username, prn, class_name, division, current_year } = req.body;
  if (!username) return res.json({ success: false, message: "Username required" });
  try {
    await db.promise().query(
      "UPDATE users SET username=?, prn=?, class_name=?, division=?, current_year=? WHERE id=?",
      [username, prn||null, class_name||null, division||null, current_year||null, req.session.user.id]
    );
    req.session.user.username = username;
    await db.promise().query(
      "INSERT INTO activity_log (user_id,activity) VALUES (?,?)",
      [req.session.user.id, "Updated profile"]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.json({ success: false, message: e.message }); }
});

/* ── ATTENDANCE ── */
router.get("/academic/attendance", auth, async (req, res) => {
  try {
    const [[row]] = await db.promise().query(
      `SELECT ROUND(
        SUM(attended) / NULLIF(SUM(total), 0) * 100
      ) AS pct 
      FROM attendance 
      WHERE user_id=?`,
      [req.session.user.id]
    );
    res.json({ attendance: row.pct || 0 });
  } catch (e) { console.error(e); res.json({ attendance: 0 }); }
});

/* ── ASSIGNMENTS ── */
router.get("/academic/assignments", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT title, subject, due_date 
       FROM assignments 
       WHERE due_date >= CURDATE() 
       ORDER BY due_date ASC`
    );
    res.json(rows);
  } catch (e) { console.error(e); res.json([]); }
});

/* ── EXAMS ── */
router.get("/academic/exams", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT subject, exam_date, exam_type 
       FROM exams 
       WHERE exam_date >= CURDATE() 
       ORDER BY exam_date ASC`
    );
    res.json(rows);
  } catch (e) { console.error(e); res.json([]); }
});

/* ── GRADES ── */
router.get("/academic/grades", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT subject, grade FROM grades WHERE user_id=?",
      [req.session.user.id]
    );
    res.json(rows);
  } catch (e) { console.error(e); res.json([]); }
});

/* ── PERFORMANCE ── */
router.get("/academic/performance", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT grade FROM grades WHERE user_id=?",
      [req.session.user.id]
    );
    if (!rows.length) return res.json({ performance: "N/A", gpa: "0.00" });
    const map = { A: 4, B: 3, C: 2, D: 1, F: 0 };
    const total = rows.reduce((s, r) => s + (map[r.grade] || 0), 0);
    const gpa = (total / rows.length).toFixed(2);
    const performance =
      gpa >= 3.5 ? "Excellent" :
      gpa >= 2.5 ? "Good" :
      gpa >= 1.5 ? "Average" : "Needs Improvement";
    res.json({ performance, gpa });
  } catch (e) { console.error(e); res.json({ performance: "N/A", gpa: "0.00" }); }
});

module.exports = router;