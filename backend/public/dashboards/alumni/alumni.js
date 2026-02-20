const express = require("express");
const router = express.Router();
const db = require("../db");
const path = require("path");
const auth = require("../middleware/authMiddleware");

function alumniOnly(req, res, next) {
  if (!req.session.user) return res.redirect("/login.html");
  if (req.session.user.role !== "alumni") return res.redirect("/dashboard");
  next();
}

/* ── PAGES ── */
router.get("/dashboard", auth, alumniOnly, (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/alumni/alumni-dashboard.html")));

router.get("/profile-page", auth, alumniOnly, (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/alumni/alumni-profile.html")));

/* ── PROFILE LOAD ── */
router.get("/profile", auth, alumniOnly, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM alumni_profiles WHERE user_id=?",[req.session.user.id]);
    res.json(rows[0] || {});
  } catch (e) { res.json({}); }
});

/* ── PROFILE UPDATE ── */
router.post("/profile/update", auth, alumniOnly, async (req, res) => {
  const { full_name, graduation_year, degree, company, job_title, work_location, linkedin } = req.body;
  try {
    await db.promise().query(
      `INSERT INTO alumni_profiles (user_id,full_name,graduation_year,degree,company,job_title,work_location,linkedin)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
       full_name=VALUES(full_name),graduation_year=VALUES(graduation_year),degree=VALUES(degree),
       company=VALUES(company),job_title=VALUES(job_title),work_location=VALUES(work_location),linkedin=VALUES(linkedin)`,
      [req.session.user.id, full_name, graduation_year||null, degree, company, job_title, work_location, linkedin]);
    res.json({ success: true });
  } catch (e) { console.error(e); res.json({ success: false }); }
});

/* ── DIRECTORY ── */
router.get("/directory", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT full_name,graduation_year,degree,company,job_title,work_location,linkedin FROM alumni_profiles ORDER BY graduation_year DESC");
    res.json(rows);
  } catch (e) { res.json([]); }
});

/* ── DASHBOARD DATA ── */
router.get("/data", auth, alumniOnly, async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [[profile]] = await db.promise().query(
      "SELECT username FROM users WHERE id=?",[uid]);
    const [ap] = await db.promise().query(
      "SELECT * FROM alumni_profiles WHERE user_id=?",[uid]);
    const [[ec]] = await db.promise().query("SELECT COUNT(*) c FROM events WHERE event_date>=CURDATE()");
    const [[nc]] = await db.promise().query("SELECT COUNT(*) c FROM notices WHERE type='global'");
    const [events] = await db.promise().query(
      "SELECT title,event_date FROM events WHERE event_date>=CURDATE() ORDER BY event_date ASC LIMIT 5");
    const [notices] = await db.promise().query(
      "SELECT title FROM notices WHERE type='global' ORDER BY id DESC LIMIT 5");
    res.json({
      name: profile?.username,
      profile: ap[0] || null,
      upcomingEvents: ec.c,
      notices: nc.c,
      events,
      noticeList: notices
    });
  } catch (e) { res.json({}); }
});

/* ── POST JOB OPPORTUNITY (as notice) ── */
router.post("/job/post", auth, alumniOnly, async (req, res) => {
  const { title } = req.body;
  if (!title) return res.json({ success: false });
  try {
    await db.promise().query(
      "INSERT INTO notices (title,type,created_by) VALUES (?,?,?)",
      [`[JOB] ${title}`, "global", req.session.user.id]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false }); }
});

/* ── SEND NOTIFICATION ── */
router.post("/notify", auth, alumniOnly, async (req, res) => {
  const { message, target_role } = req.body;
  if (!message) return res.json({ success: false });
  try {
    const [users] = await db.promise().query(
      "SELECT id FROM users WHERE role=?",[target_role||"student"]);
    const inserts = users.map(u => [u.id, message]);
    if (inserts.length) {
      await db.promise().query(
        "INSERT INTO notifications (user_id,message) VALUES ?", [inserts]);
    }
    res.json({ success: true, sent: inserts.length });
  } catch (e) { res.json({ success: false }); }
});

module.exports = router;