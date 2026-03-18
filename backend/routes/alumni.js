"use strict";

const express = require("express");
const router  = express.Router();
const db      = require("../db");
const path    = require("path");
const auth    = require("../middleware/authMiddleware");
const alumniMiddleware = require("../middleware/alumniMiddleware");

router.use(auth);

/* ── HTML PAGES ── */
router.get("/dashboard", alumniMiddleware, (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/alumni/alumni-dashboard.html")));

router.get("/profile-page", alumniMiddleware, (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/alumni/alumni-profile.html")));

router.get("/directory-page", auth, (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/alumni/alumni-directory.html")));

/* ── PROFILE ── */
router.get("/profile", alumniMiddleware, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM alumni_profiles WHERE user_id=?", [req.session.user.id]
    );
    res.json(rows[0] || {});
  } catch (e) { res.json({}); }
});

router.post("/profile/update", alumniMiddleware, async (req, res) => {
  const { full_name, graduation_year, degree, company, job_title, work_location, linkedin } = req.body;
  try {
    await db.promise().query(
      `INSERT INTO alumni_profiles
         (user_id, full_name, graduation_year, degree, company, job_title, work_location, linkedin)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         full_name=VALUES(full_name), graduation_year=VALUES(graduation_year),
         degree=VALUES(degree), company=VALUES(company), job_title=VALUES(job_title),
         work_location=VALUES(work_location), linkedin=VALUES(linkedin)`,
      [req.session.user.id, full_name, graduation_year||null, degree, company, job_title, work_location, linkedin]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.json({ success: false }); }
});

/* ── DIRECTORY ── */
router.get("/directory", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT full_name, graduation_year, degree, company, job_title, work_location, linkedin FROM alumni_profiles ORDER BY graduation_year DESC"
    );
    res.json(rows);
  } catch (e) { res.json([]); }
});

/* ── DASHBOARD DATA
   notices has no 'type' column — removed WHERE type='global'
── */
router.get("/data", alumniMiddleware, async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [[profile]] = await db.promise().query(
      "SELECT username FROM users WHERE id=?", [uid]
    );

    const [[ec]] = await db.promise().query(
      "SELECT COUNT(*) c FROM events WHERE event_date >= CURDATE()"
    );

    /* notices has no type column — count all notices */
    const [[nc]] = await db.promise().query(
      "SELECT COUNT(*) c FROM notices"
    );

    const [events] = await db.promise().query(
      "SELECT title, event_date FROM events WHERE event_date >= CURDATE() ORDER BY event_date ASC LIMIT 5"
    );

    /* notices — no type filter */
    const [notices] = await db.promise().query(
      "SELECT title FROM notices ORDER BY created_at DESC LIMIT 5"
    );

    res.json({
      name:           profile?.username,
      upcomingEvents: ec.c,
      notices:        nc.c,
      events,
      noticeList:     notices
    });
  } catch (e) { console.error(e); res.json({}); }
});

/* ── JOB POSTING ── */
router.post("/job/post", alumniMiddleware, async (req, res) => {
  const { company_name, job_title, job_description, location, salary_range, requirements, application_link } = req.body;
  const uid = req.session.user.id;
  if (!company_name || !job_title)
    return res.json({ success: false, message: "Company and job title required" });
  try {
    await db.promise().query(
      `INSERT INTO alumni_jobs
         (alumni_id, company_name, job_title, job_description, location, salary_range, requirements, application_link, status)
       VALUES (?,?,?,?,?,?,?,?,'approved')`,
      [uid, company_name, job_title, job_description, location, salary_range, requirements, application_link]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.json({ success: false }); }
});

router.get("/jobs/my", alumniMiddleware, async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [jobs] = await db.promise().query(
      `SELECT j.*, COUNT(a.id) AS application_count
       FROM alumni_jobs j
       LEFT JOIN job_applications a ON j.id = a.job_id
       WHERE j.alumni_id = ?
       GROUP BY j.id
       ORDER BY j.created_at DESC`,
      [uid]
    );
    res.json(jobs);
  } catch (e) { console.error(e); res.json([]); }
});

router.get("/jobs/all", auth, async (req, res) => {
  try {
    const [jobs] = await db.promise().query(
      `SELECT j.*, u.username AS alumni_name
       FROM alumni_jobs j
       JOIN users u ON j.alumni_id = u.id
       WHERE j.status = 'approved'
       ORDER BY j.created_at DESC`
    );
    res.json(jobs);
  } catch (e) { console.error(e); res.json([]); }
});

router.post("/job/apply", auth, async (req, res) => {
  const { job_id, cover_letter } = req.body;
  if (!job_id) return res.json({ success: false, message: "Job ID required" });
  try {
    await db.promise().query(
      "INSERT INTO job_applications (student_id, job_id, cover_letter, status) VALUES (?,?,?,'applied')",
      [req.session.user.id, job_id, cover_letter]
    );
    res.json({ success: true });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY") return res.json({ success: false, message: "Already applied" });
    console.error(e); res.json({ success: false });
  }
});

router.get("/job/applications/:job_id", alumniMiddleware, async (req, res) => {
  try {
    const [applications] = await db.promise().query(
      `SELECT a.*, u.username, u.email, u.prn, u.class_name
       FROM job_applications a
       JOIN users u ON a.student_id = u.id
       WHERE a.job_id = ?
       ORDER BY a.applied_at DESC`,
      [req.params.job_id]
    );
    res.json(applications);
  } catch (e) { console.error(e); res.json([]); }
});

/* ── SEND NOTIFICATION TO STUDENTS ── */
router.post("/notify", alumniMiddleware, async (req, res) => {
  const { message, target_role } = req.body;
  if (!message) return res.json({ success: false });
  try {
    const [users] = await db.promise().query(
      "SELECT id FROM users WHERE role=?", [target_role || "student"]
    );
    const inserts = users.map(u => [u.id, message]);
    if (inserts.length) {
      await db.promise().query(
        "INSERT INTO notifications (user_id, message) VALUES ?", [inserts]
      );
    }
    res.json({ success: true, sent: inserts.length });
  } catch (e) { res.json({ success: false }); }
});

module.exports = router;