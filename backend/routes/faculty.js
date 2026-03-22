"use strict";
/* ============================================================
   faculty.js — Faculty Portal Routes
   Handles: dashboard, students, assignments, attendance,
            exams, grades, courses, notifications, resources
============================================================ */

const express  = require("express");
const router   = express.Router();
const db       = require("../db");
const path     = require("path");
const fs       = require("fs");
const multer   = require("multer");
const auth     = require("../middleware/authMiddleware");
const faculty  = require("../middleware/facultyMiddleware");

router.use(auth, faculty);

/* ── Upload setup ── */
const uploadDir = path.join(__dirname, "../public/uploads/resources");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `res_${Date.now()}_${safe}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

/* ════════════════════════════════════════
   HTML PAGES
════════════════════════════════════════ */
router.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-dashboard.html")));
router.get("/students", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-students.html")));
router.get("/academics", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-academics.html")));
router.get("/attendance", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-attendance.html")));
router.get("/grades", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-grades.html")));
router.get("/course-view", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-course-view.html")));

/* ════════════════════════════════════════
   DASHBOARD DATA
════════════════════════════════════════ */
router.get("/data", async (req, res) => {
  const fid = req.session.user.id;
  try {
    const [[faculty]] = await db.promise().query(
      "SELECT id, username AS name, email FROM users WHERE id = ?", [fid]);

    let totalStudents = 0, totalAssignments = 0, totalExams = 0, myCourses = 0;

    try {
      const [[r]] = await db.promise().query(
        "SELECT COUNT(DISTINCT student_id) AS c FROM grades WHERE faculty_id = ?", [fid]);
      totalStudents = r.c;
    } catch (_) {
      try {
        const [[r]] = await db.promise().query(
          `SELECT COUNT(DISTINCT ce.student_id) AS c
           FROM course_enrollments ce
           JOIN courses c ON ce.course_id = c.id
           WHERE c.faculty_id = ?`, [fid]);
        totalStudents = r.c;
      } catch (_) {}
    }

    try {
      const [[r]] = await db.promise().query(
        "SELECT COUNT(*) AS c FROM assignments WHERE faculty_id = ?", [fid]);
      totalAssignments = r.c;
    } catch (_) {
      try {
        const [[r]] = await db.promise().query(
          "SELECT COUNT(*) AS c FROM course_assignments WHERE faculty_id = ?", [fid]);
        totalAssignments = r.c;
      } catch (_) {}
    }

    try {
      const [[r]] = await db.promise().query(
        "SELECT COUNT(*) AS c FROM exams WHERE faculty_id = ?", [fid]);
      totalExams = r.c;
    } catch (_) {}

    try {
      const [[r]] = await db.promise().query(
        "SELECT COUNT(*) AS c FROM courses WHERE faculty_id = ?", [fid]);
      myCourses = r.c;
    } catch (_) {}

    // Recent activity
    let activity = [];
    try {
      const [rows] = await db.promise().query(
        `SELECT action AS message, created_at FROM activity_log
         WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`, [fid]);
      activity = rows;
    } catch (_) {}

    res.json({
      name: faculty?.name || req.session.user.username,
      totalStudents,
      totalAssignments,
      totalExams,
      myCourses,
      activity
    });
  } catch (e) {
    console.error("[FACULTY] /data:", e.message);
    res.json({
      name: req.session.user.username,
      totalStudents: 0, totalAssignments: 0,
      totalExams: 0, myCourses: 0, activity: []
    });
  }
});

router.get("/analytics", async (req, res) => {
  const fid = req.session.user.id;
  try {
    let avgAttendance = 0, gradeDistribution = [];

    try {
      const [[r]] = await db.promise().query(
        `SELECT ROUND(AVG(CASE WHEN status='present' THEN 100 ELSE 0 END)) AS avg
         FROM attendance WHERE faculty_id = ?`, [fid]);
      avgAttendance = r?.avg || 0;
    } catch (_) {}

    try {
      const [rows] = await db.promise().query(
        `SELECT grade, COUNT(*) AS count FROM grades
         WHERE faculty_id = ? GROUP BY grade ORDER BY grade`, [fid]);
      gradeDistribution = rows;
    } catch (_) {}

    res.json({ avgAttendance, gradeDistribution });
  } catch (e) {
    res.json({ avgAttendance: 0, gradeDistribution: [] });
  }
});

/* ════════════════════════════════════════
   STUDENTS
════════════════════════════════════════ */
router.get("/students/list", async (req, res) => {
  const fid = req.session.user.id;
  try {
    // Try to get students from courses this faculty teaches
    const [students] = await db.promise().query(
      `SELECT DISTINCT u.id, u.username, u.email, u.prn, u.class_name, u.current_year,
              COALESCE(
                (SELECT ROUND(AVG(CASE WHEN a.status='present' THEN 100 ELSE 0 END))
                 FROM attendance a WHERE a.student_id = u.id AND a.faculty_id = ?), 0
              ) AS attendance_pct,
              COALESCE(
                (SELECT AVG(g.marks) FROM grades g
                 WHERE g.student_id = u.id AND g.faculty_id = ?), 0
              ) AS avg_marks
       FROM users u
       WHERE u.role = 'student'
       ORDER BY u.username`, [fid, fid]);
    res.json(students);
  } catch (e) {
    console.error("[FACULTY] /students/list:", e.message);
    res.json([]);
  }
});

/* ════════════════════════════════════════
   COURSES (legacy — basic list)
════════════════════════════════════════ */
router.get("/courses/my", async (req, res) => {
  const fid = req.session.user.id;
  try {
    const [courses] = await db.promise().query(
      `SELECT c.*,
         (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id) AS student_count
       FROM courses c WHERE c.faculty_id = ? ORDER BY c.created_at DESC`, [fid]);
    res.json(courses);
  } catch (e) {
    res.json([]);
  }
});

router.post("/courses/create", async (req, res) => {
  const fid = req.session.user.id;
  const { title, description, subject_code, batch } = req.body;
  if (!title?.trim()) return res.json({ success: false, message: "Title required" });
  try {
    const key = Math.random().toString(36).substring(2, 8).toUpperCase();
    const [r] = await db.promise().query(
      `INSERT INTO courses (title, description, subject_code, faculty_id, enrollment_key)
       VALUES (?,?,?,?,?)`,
      [title.trim(), description || null, subject_code || null, fid, key]);
    res.json({ success: true, course_id: r.insertId, enrollment_key: key });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

/* ════════════════════════════════════════
   ASSIGNMENTS
════════════════════════════════════════ */
router.get("/assignments/list", async (req, res) => {
  const fid = req.session.user.id;
  try {
    // Try course_assignments first, fall back to assignments table
    try {
      const [rows] = await db.promise().query(
        `SELECT ca.*,
           c.title AS course_name,
           (SELECT COUNT(*) FROM course_submissions cs WHERE cs.assignment_id = ca.id) AS submitted_count,
           (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = ca.course_id) AS total_students
         FROM course_assignments ca
         LEFT JOIN courses c ON ca.course_id = c.id
         WHERE ca.faculty_id = ?
         ORDER BY ca.created_at DESC`, [fid]);
      return res.json(rows);
    } catch (_) {}

    const [rows] = await db.promise().query(
      "SELECT * FROM assignments WHERE faculty_id = ? ORDER BY created_at DESC", [fid]);
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

router.get("/assignment/:id/submissions", async (req, res) => {
  const fid = req.session.user.id;
  const asgnId = req.params.id;
  try {
    // course_submissions
    try {
      const [submitted] = await db.promise().query(
        `SELECT cs.*, u.username, u.prn, u.class_name
         FROM course_submissions cs JOIN users u ON cs.student_id = u.id
         WHERE cs.assignment_id = ?`, [asgnId]);
      const [notSubmitted] = await db.promise().query(
        `SELECT u.id AS student_id, u.username, u.prn, u.class_name
         FROM course_enrollments ce JOIN users u ON ce.student_id = u.id
         WHERE ce.course_id = (SELECT course_id FROM course_assignments WHERE id = ?)
           AND ce.student_id NOT IN (SELECT student_id FROM course_submissions WHERE assignment_id = ?)
         ORDER BY u.username`, [asgnId, asgnId]);
      return res.json({ submitted, notSubmitted });
    } catch (_) {}

    // Fall back to submissions table
    const [submitted] = await db.promise().query(
      `SELECT s.*, u.username, u.prn, u.class_name
       FROM submissions s JOIN users u ON s.student_id = u.id
       WHERE s.assignment_id = ?`, [asgnId]);
    res.json({ submitted, notSubmitted: [] });
  } catch (e) {
    res.json({ submitted: [], notSubmitted: [] });
  }
});

/* ════════════════════════════════════════
   ATTENDANCE
════════════════════════════════════════ */
router.get("/attendance/records", async (req, res) => {
  const fid = req.session.user.id;
  try {
    // Try attendance_sessions first
    try {
      const [sessions] = await db.promise().query(
        `SELECT s.*, c.title AS course_name,
           (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id AND ar.status='present') AS present_count,
           (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = s.id) AS total_count
         FROM attendance_sessions s
         LEFT JOIN courses c ON s.course_id = c.id
         WHERE s.faculty_id = ?
         ORDER BY s.session_date DESC LIMIT 20`, [fid]);
      return res.json(sessions);
    } catch (_) {}

    const [rows] = await db.promise().query(
      "SELECT * FROM attendance WHERE faculty_id = ? ORDER BY date DESC LIMIT 50", [fid]);
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

router.post("/attendance/create-session", async (req, res) => {
  const fid = req.session.user.id;
  const { course_id, session_date, topic } = req.body;
  if (!course_id || !session_date)
    return res.json({ success: false, message: "Course and date required" });
  try {
    const [r] = await db.promise().query(
      `INSERT INTO attendance_sessions (faculty_id, course_id, session_date, topic)
       VALUES (?,?,?,?)`, [fid, course_id, session_date, topic || null]);
    res.json({ success: true, session_id: r.insertId });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

router.post("/attendance/mark", async (req, res) => {
  const fid = req.session.user.id;
  const { session_id, records } = req.body;
  if (!session_id || !records?.length)
    return res.json({ success: false, message: "Session and records required" });
  try {
    for (const rec of records) {
      await db.promise().query(
        `INSERT INTO attendance_records (session_id, student_id, status)
         VALUES (?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        [session_id, rec.student_id, rec.status || "absent"]);
    }
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

/* ════════════════════════════════════════
   EXAMS
════════════════════════════════════════ */
router.get("/exams/list", async (req, res) => {
  const fid = req.session.user.id;
  try {
    const [exams] = await db.promise().query(
      "SELECT * FROM exams WHERE faculty_id = ? ORDER BY exam_date DESC", [fid]);
    res.json(exams);
  } catch (e) {
    res.json([]);
  }
});

router.post("/exams/create", async (req, res) => {
  const fid = req.session.user.id;
  const { title, subject, exam_date, duration, total_marks, course_id } = req.body;
  if (!title?.trim()) return res.json({ success: false, message: "Title required" });
  try {
    const [r] = await db.promise().query(
      `INSERT INTO exams (title, subject, exam_date, duration, total_marks, faculty_id, course_id)
       VALUES (?,?,?,?,?,?,?)`,
      [title.trim(), subject || null, exam_date || null,
       duration || null, total_marks || 100, fid, course_id || null]);
    res.json({ success: true, exam_id: r.insertId });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

/* ════════════════════════════════════════
   GRADES / MARKS
════════════════════════════════════════ */
router.get("/grades/list", async (req, res) => {
  const fid = req.session.user.id;
  const { course_id } = req.query;
  try {
    let query = `SELECT g.*, u.username, u.prn, u.class_name
                 FROM grades g JOIN users u ON g.student_id = u.id
                 WHERE g.faculty_id = ?`;
    const params = [fid];
    if (course_id) { query += " AND g.course_id = ?"; params.push(course_id); }
    query += " ORDER BY u.username";
    const [rows] = await db.promise().query(query, params);
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

router.post("/grades/save", async (req, res) => {
  const fid = req.session.user.id;
  const { student_id, course_id, subject, marks, grade, exam_type } = req.body;
  if (!student_id || marks === undefined)
    return res.json({ success: false, message: "Student and marks required" });
  try {
    await db.promise().query(
      `INSERT INTO grades (student_id, faculty_id, course_id, subject, marks, grade, exam_type)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE marks=VALUES(marks), grade=VALUES(grade), updated_at=NOW()`,
      [student_id, fid, course_id || null, subject || null,
       parseFloat(marks), grade || null, exam_type || null]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

/* ════════════════════════════════════════
   NOTIFICATIONS
════════════════════════════════════════ */
router.post("/notify", async (req, res) => {
  const fid = req.session.user.id;
  const { message, target, course_id } = req.body;
  if (!message?.trim()) return res.json({ success: false, message: "Message required" });
  try {
    let students = [];
    if (target === "all") {
      const [rows] = await db.promise().query(
        "SELECT id AS student_id FROM users WHERE role='student'");
      students = rows;
    } else if (course_id) {
      const [rows] = await db.promise().query(
        "SELECT student_id FROM course_enrollments WHERE course_id = ?", [course_id]);
      students = rows;
    }
    for (const s of students) {
      await db.promise().query(
        "INSERT INTO notifications (user_id, message) VALUES (?,?)",
        [s.student_id, message.trim()]).catch(() => {});
    }
    // Log in faculty_notifications if table exists
    try {
      await db.promise().query(
        "INSERT INTO faculty_notifications (faculty_id, message, target) VALUES (?,?,?)",
        [fid, message.trim(), target || "custom"]);
    } catch (_) {}
    res.json({ success: true, sent: students.length });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

router.get("/notifications/sent", async (req, res) => {
  const fid = req.session.user.id;
  try {
    const [rows] = await db.promise().query(
      `SELECT * FROM faculty_notifications
       WHERE faculty_id = ? ORDER BY created_at DESC LIMIT 20`, [fid]);
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

/* ════════════════════════════════════════
   RESOURCES
════════════════════════════════════════ */
router.get("/resources/my", async (req, res) => {
  const fid = req.session.user.id;
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM resources WHERE uploaded_by = ? ORDER BY created_at DESC", [fid]);
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

router.post("/resources/upload", upload.single("file"), async (req, res) => {
  const fid = req.session.user.id;
  if (!req.file) return res.json({ success: false, message: "No file uploaded" });
  const { title, description, subject, resource_type } = req.body;
  if (!title?.trim()) return res.json({ success: false, message: "Title required" });
  try {
    await db.promise().query(
      `INSERT INTO resources (title, description, subject, resource_type, file_path, file_name, uploaded_by)
       VALUES (?,?,?,?,?,?,?)`,
      [title.trim(), description || null, subject || null,
       resource_type || "document",
       `uploads/resources/${req.file.filename}`,
       req.file.originalname, fid]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

/* ════════════════════════════════════════
   BATCHES / COURSE BATCHES
════════════════════════════════════════ */
router.get("/batches/list", async (req, res) => {
  const fid = req.session.user.id;
  try {
    const [rows] = await db.promise().query(
      `SELECT cb.*, c.title AS course_title
       FROM course_batches cb JOIN courses c ON cb.course_id = c.id
       WHERE c.faculty_id = ? ORDER BY cb.id DESC`, [fid]);
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

module.exports = router;