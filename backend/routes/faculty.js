const express = require("express");
const router = express.Router();
const db = require("../db");
const path = require("path");
const auth = require("../middleware/authMiddleware");
const facultyOnly = require("../middleware/facultyMiddleware");

// Apply auth + role check to all faculty routes
router.use(auth, facultyOnly);


/* =====================================================
   FACULTY DASHBOARD PAGE
===================================================== */
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-dashboard.html"));
});

router.get("/students", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-students.html"));
});

router.get("/academics", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-academics.html"));
});


/* =====================================================
   DASHBOARD SUMMARY DATA
===================================================== */
router.get("/data", async (req, res) => {
  const facultyId = req.session.user.id;

  try {
    const [[studentRows]] = await db.promise().query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'student'"
    );
    const [[assignmentRows]] = await db.promise().query(
      "SELECT COUNT(*) AS count FROM assignments WHERE faculty_id = ?",
      [facultyId]
    );
    const [[examRows]] = await db.promise().query(
      "SELECT COUNT(*) AS count FROM exams WHERE faculty_id = ?",
      [facultyId]
    );
    const [[gradeRows]] = await db.promise().query(
      "SELECT COUNT(*) AS count FROM grades WHERE faculty_id = ?",
      [facultyId]
    );

    res.json({
      name: req.session.user.username,
      totalStudents: studentRows.count,
      totalAssignments: assignmentRows.count,
      totalExams: examRows.count,
      totalGrades: gradeRows.count
    });

  } catch (err) {
    console.error("FACULTY DATA ERROR:", err);
    res.json({ name: req.session.user.username, totalStudents: 0, totalAssignments: 0, totalExams: 0, totalGrades: 0 });
  }
});


/* =====================================================
   GET ASSIGNED STUDENTS
===================================================== */
router.get("/students/list", async (req, res) => {
  try {
    const [students] = await db.promise().query(
      `SELECT id, username, email, prn, class_name, division, current_year
       FROM users
       WHERE role = 'student'
       ORDER BY class_name, username`
    );
    res.json(students);
  } catch (err) {
    console.error("STUDENTS FETCH ERROR:", err);
    res.json([]);
  }
});


/* =====================================================
   GET STUDENT PERFORMANCE SUMMARY
===================================================== */
router.get("/students/performance", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT u.id, u.username, u.prn, u.class_name,
              ROUND(AVG(CASE g.grade WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 WHEN 'D' THEN 1 ELSE 0 END), 2) AS gpa,
              ROUND(SUM(a.attended) / NULLIF(SUM(a.total), 0) * 100) AS attendance
       FROM users u
       LEFT JOIN grades g ON g.user_id = u.id
       LEFT JOIN attendance a ON a.user_id = u.id
       WHERE u.role = 'student'
       GROUP BY u.id
       ORDER BY u.class_name, u.username`
    );
    res.json(rows);
  } catch (err) {
    console.error("PERFORMANCE ERROR:", err);
    res.json([]);
  }
});


/* =====================================================
   UPLOAD ASSIGNMENT
===================================================== */
router.post("/assignment/add", async (req, res) => {
  const facultyId = req.session.user.id;
  const { title, subject, description, due_date } = req.body;

  if (!title || !due_date) {
    return res.json({ success: false, message: "Title and due date required" });
  }

  try {
    await db.promise().query(
      `INSERT INTO assignments (title, subject, description, due_date, faculty_id)
       VALUES (?, ?, ?, ?, ?)`,
      [title, subject || null, description || null, due_date, facultyId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("ASSIGNMENT ADD ERROR:", err);
    res.json({ success: false, message: err.message });
  }
});


/* =====================================================
   GET ASSIGNMENTS (BY THIS FACULTY)
===================================================== */
router.get("/assignments/list", async (req, res) => {
  const facultyId = req.session.user.id;
  try {
    const [rows] = await db.promise().query(
      `SELECT * FROM assignments WHERE faculty_id = ? ORDER BY due_date ASC`,
      [facultyId]
    );
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});


/* =====================================================
   UPDATE ATTENDANCE
===================================================== */
router.post("/attendance/update", async (req, res) => {
  const { user_id, attended, total, subject, date } = req.body;

  if (!user_id || attended === undefined || !total) {
    return res.json({ success: false, message: "user_id, attended, total required" });
  }

  try {
    // Upsert by user_id + subject + date
    await db.promise().query(
      `INSERT INTO attendance (user_id, attended, total, subject, date)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE attended = VALUES(attended), total = VALUES(total)`,
      [user_id, attended, total, subject || null, date || new Date().toISOString().slice(0, 10)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("ATTENDANCE UPDATE ERROR:", err);
    res.json({ success: false, message: err.message });
  }
});


/* =====================================================
   GET ATTENDANCE FOR A STUDENT
===================================================== */
router.get("/attendance/:userId", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC`,
      [req.params.userId]
    );
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});


/* =====================================================
   ADD EXAM SCHEDULE
===================================================== */
router.post("/exam/add", async (req, res) => {
  const facultyId = req.session.user.id;
  const { user_id, subject, exam_date, exam_type } = req.body;

  if (!subject || !exam_date) {
    return res.json({ success: false, message: "Subject and exam date required" });
  }

  try {
    await db.promise().query(
      `INSERT INTO exams (user_id, subject, exam_date, exam_type, faculty_id)
       VALUES (?, ?, ?, ?, ?)`,
      [user_id || null, subject, exam_date, exam_type || "Regular", facultyId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("EXAM ADD ERROR:", err);
    res.json({ success: false, message: err.message });
  }
});


/* =====================================================
   GET EXAMS (BY THIS FACULTY)
===================================================== */
router.get("/exams/list", async (req, res) => {
  const facultyId = req.session.user.id;
  try {
    const [rows] = await db.promise().query(
      `SELECT * FROM exams WHERE faculty_id = ? ORDER BY exam_date ASC`,
      [facultyId]
    );
    res.json(rows);
  } catch (err) {
    res.json([]);
  }
});


/* =====================================================
   ENTER GRADE
===================================================== */
router.post("/grade/add", async (req, res) => {
  const facultyId = req.session.user.id;
  const { user_id, subject, grade } = req.body;

  if (!user_id || !subject || !grade) {
    return res.json({ success: false, message: "user_id, subject, grade required" });
  }

  try {
    await db.promise().query(
      `INSERT INTO grades (user_id, subject, grade, faculty_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE grade = VALUES(grade)`,
      [user_id, subject, grade, facultyId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("GRADE ADD ERROR:", err);
    res.json({ success: false, message: err.message });
  }
});


/* =====================================================
   ANALYTICS: ATTENDANCE AVERAGE + GRADE DISTRIBUTION
===================================================== */
router.get("/analytics", async (req, res) => {
  const facultyId = req.session.user.id;

  try {
    const [[attRow]] = await db.promise().query(
      `SELECT ROUND(SUM(attended) / NULLIF(SUM(total), 0) * 100) AS avg_attendance
       FROM attendance`
    );

    const [gradeDist] = await db.promise().query(
      `SELECT grade, COUNT(*) AS count
       FROM grades
       WHERE faculty_id = ?
       GROUP BY grade
       ORDER BY grade`,
      [facultyId]
    );

    const [[submissionRow]] = await db.promise().query(
      `SELECT COUNT(*) AS count FROM assignments WHERE faculty_id = ?`,
      [facultyId]
    );

    res.json({
      avgAttendance: attRow.avg_attendance || 0,
      gradeDistribution: gradeDist,
      totalSubmissions: submissionRow.count
    });

  } catch (err) {
    console.error("ANALYTICS ERROR:", err);
    res.json({ avgAttendance: 0, gradeDistribution: [], totalSubmissions: 0 });
  }
});


module.exports = router;