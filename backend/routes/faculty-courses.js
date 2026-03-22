"use strict";
/* ============================================================
   faculty-courses.js — NEW ROUTE FILE
   
   Mount in index.js as: app.use("/faculty/courses", require("./routes/faculty-courses"));
   
   Endpoints:
   GET  /faculty/courses/               → serve HTML page
   GET  /faculty/courses/list           → faculty's own courses only
   POST /faculty/courses/create         → create new course (generates enrollment key)
   POST /faculty/courses/toggle         → activate/deactivate course
   DELETE /faculty/courses/:id          → delete course
   
   GET  /faculty/courses/:id/detail     → course details + enrolled students
   GET  /faculty/courses/:id/students   → enrolled students list
   
   POST /faculty/courses/:id/assignments/create  → upload assignment
   GET  /faculty/courses/:id/assignments         → list assignments
   DELETE /faculty/courses/assignments/:asgn_id  → delete assignment
   
   GET  /faculty/courses/assignments/:asgn_id/submissions  → all submissions
   POST /faculty/courses/submissions/:sub_id/grade         → grade a submission
============================================================ */

const express  = require("express");
const router   = express.Router();
const db       = require("../db");
const path     = require("path");
const fs       = require("fs");
const multer   = require("multer");
const crypto   = require("crypto");
const auth     = require("../middleware/authMiddleware");
const faculty  = require("../middleware/facultyMiddleware");

router.use(auth, faculty);

/* ── Upload dirs ── */
const assignDir = path.join(__dirname, "../public/uploads/assignments");
if (!fs.existsSync(assignDir)) fs.mkdirSync(assignDir, { recursive: true });

const assignStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, assignDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `asgn_${Date.now()}_${safe}`);
  }
});
const uploadAssign = multer({
  storage: assignStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

/* ── Generate enrollment key ── */
function genKey() {
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. A1B2C3D4
}

/* ════════════════ HTML PAGE ════════════════ */
router.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-courses.html"))
);

/* ════════════════ COURSE LIST (my courses only) ════════════════ */
router.get("/list", async (req, res) => {
  const fid = req.session.user.id;
  try {
    const [courses] = await db.promise().query(
      `SELECT c.*,
         (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id) AS student_count,
         (SELECT COUNT(*) FROM course_assignments ca WHERE ca.course_id = c.id) AS assignment_count
       FROM courses c
       WHERE c.faculty_id = ?
       ORDER BY c.created_at DESC`,
      [fid]
    );
    res.json(courses);
  } catch (e) {
    console.error("[FACULTY-COURSES] /list:", e.message);
    res.json([]);
  }
});

/* ════════════════ CREATE COURSE ════════════════ */
router.post("/create", async (req, res) => {
  const fid = req.session.user.id;
  const { title, description, subject_code, branch, semester, academic_year, max_students } = req.body;
  if (!title?.trim()) return res.json({ success: false, message: "Course title is required" });

  let key = genKey();
  // Ensure uniqueness
  try {
    let attempts = 0;
    while (attempts < 5) {
      const [[exists]] = await db.promise().query(
        "SELECT id FROM courses WHERE enrollment_key = ?", [key]);
      if (!exists) break;
      key = genKey();
      attempts++;
    }

    const [r] = await db.promise().query(
      `INSERT INTO courses (title, description, subject_code, faculty_id, enrollment_key,
                            branch, semester, academic_year, max_students, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,1)`,
      [title.trim(), description || null, subject_code || null, fid, key,
       branch || null, semester || null, academic_year || null,
       parseInt(max_students) || 100]
    );

    res.json({ success: true, course_id: r.insertId, enrollment_key: key });
  } catch (e) {
    console.error("[FACULTY-COURSES] /create:", e.message);
    res.json({ success: false, message: e.message });
  }
});

/* ════════════════ TOGGLE ACTIVE ════════════════ */
router.post("/toggle", async (req, res) => {
  const fid = req.session.user.id;
  const { course_id } = req.body;
  try {
    // Verify ownership
    const [[course]] = await db.promise().query(
      "SELECT id, is_active FROM courses WHERE id = ? AND faculty_id = ?", [course_id, fid]);
    if (!course) return res.json({ success: false, message: "Course not found" });
    await db.promise().query(
      "UPDATE courses SET is_active = ? WHERE id = ? AND faculty_id = ?",
      [course.is_active ? 0 : 1, course_id, fid]);
    res.json({ success: true, is_active: !course.is_active });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

/* ════════════════ DELETE COURSE ════════════════ */
router.delete("/:id", async (req, res) => {
  const fid = req.session.user.id;
  const courseId = req.params.id;
  try {
    const [[course]] = await db.promise().query(
      "SELECT id FROM courses WHERE id = ? AND faculty_id = ?", [courseId, fid]);
    if (!course) return res.json({ success: false, message: "Course not found" });
    await db.promise().query("DELETE FROM courses WHERE id = ? AND faculty_id = ?", [courseId, fid]);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

/* ════════════════ COURSE DETAIL ════════════════ */
router.get("/:id/detail", async (req, res) => {
  const fid = req.session.user.id;
  const courseId = req.params.id;
  try {
    // Verify ownership
    const [[course]] = await db.promise().query(
      "SELECT * FROM courses WHERE id = ? AND faculty_id = ?", [courseId, fid]);
    if (!course) return res.status(404).json({ error: "Course not found" });

    const [students] = await db.promise().query(
      `SELECT u.id, u.username, u.email, u.prn, u.class_name, u.current_year,
              ce.enrolled_at
       FROM course_enrollments ce JOIN users u ON ce.student_id = u.id
       WHERE ce.course_id = ?
       ORDER BY u.username`, [courseId]);

    const [assignments] = await db.promise().query(
      `SELECT ca.*,
         (SELECT COUNT(*) FROM course_submissions cs WHERE cs.assignment_id = ca.id) AS submission_count,
         (SELECT COUNT(*) FROM course_submissions cs WHERE cs.assignment_id = ca.id AND cs.status = 'graded') AS graded_count
       FROM course_assignments ca WHERE ca.course_id = ? ORDER BY ca.created_at DESC`,
      [courseId]);

    res.json({ course, students, assignments });
  } catch (e) {
    console.error("[FACULTY-COURSES] /detail:", e.message);
    res.status(500).json({ error: e.message });
  }
});

/* ════════════════ ENROLLED STUDENTS ════════════════ */
router.get("/:id/students", async (req, res) => {
  const fid = req.session.user.id;
  const courseId = req.params.id;
  try {
    const [[own]] = await db.promise().query(
      "SELECT id FROM courses WHERE id = ? AND faculty_id = ?", [courseId, fid]);
    if (!own) return res.json([]);
    const [students] = await db.promise().query(
      `SELECT u.id, u.username, u.email, u.prn, u.class_name, u.current_year, ce.enrolled_at
       FROM course_enrollments ce JOIN users u ON ce.student_id = u.id
       WHERE ce.course_id = ? ORDER BY u.username`, [courseId]);
    res.json(students);
  } catch (e) { res.json([]); }
});

/* ════════════════ ASSIGNMENTS ════════════════ */
router.get("/:id/assignments", async (req, res) => {
  const fid = req.session.user.id;
  const courseId = req.params.id;
  try {
    const [[own]] = await db.promise().query(
      "SELECT id FROM courses WHERE id = ? AND faculty_id = ?", [courseId, fid]);
    if (!own) return res.json([]);
    const [assignments] = await db.promise().query(
      `SELECT ca.*,
         (SELECT COUNT(*) FROM course_submissions cs WHERE cs.assignment_id = ca.id) AS submission_count,
         (SELECT COUNT(*) FROM course_submissions cs WHERE cs.assignment_id = ca.id AND cs.status='graded') AS graded_count,
         (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = ca.course_id) AS total_students
       FROM course_assignments ca WHERE ca.course_id = ? ORDER BY ca.due_date ASC, ca.created_at DESC`,
      [courseId]);
    res.json(assignments);
  } catch (e) { res.json([]); }
});

/* CREATE ASSIGNMENT */
router.post("/:id/assignments/create", uploadAssign.single("file"), async (req, res) => {
  const fid = req.session.user.id;
  const courseId = req.params.id;
  const { title, description, due_date, max_marks } = req.body;

  if (!title?.trim()) return res.json({ success: false, message: "Assignment title required" });

  try {
    const [[own]] = await db.promise().query(
      "SELECT id, title AS course_title FROM courses WHERE id = ? AND faculty_id = ?", [courseId, fid]);
    if (!own) return res.json({ success: false, message: "Course not found or not yours" });

    const filePath = req.file ? `uploads/assignments/${req.file.filename}` : null;

    const [r] = await db.promise().query(
      `INSERT INTO course_assignments (course_id, faculty_id, title, description, due_date, max_marks, file_path)
       VALUES (?,?,?,?,?,?,?)`,
      [courseId, fid, title.trim(), description || null,
       due_date || null, parseInt(max_marks) || 100, filePath]
    );

    // Notify all enrolled students
    try {
      const [students] = await db.promise().query(
        "SELECT student_id FROM course_enrollments WHERE course_id = ?", [courseId]);
      for (const s of students) {
        await db.promise().query(
          "INSERT INTO notifications (user_id, message) VALUES (?,?)",
          [s.student_id, `📝 New assignment "${title}" posted in course "${own.course_title}". ${due_date ? `Due: ${due_date}` : ""}`]
        ).catch(() => {});
      }
    } catch (_) {}

    res.json({ success: true, assignment_id: r.insertId });
  } catch (e) {
    console.error("[FACULTY-COURSES] create assignment:", e.message);
    res.json({ success: false, message: e.message });
  }
});

/* DELETE ASSIGNMENT */
router.delete("/assignments/:asgn_id", async (req, res) => {
  const fid = req.session.user.id;
  const asgnId = req.params.asgn_id;
  try {
    const [[a]] = await db.promise().query(
      "SELECT id, file_path FROM course_assignments WHERE id = ? AND faculty_id = ?", [asgnId, fid]);
    if (!a) return res.json({ success: false, message: "Assignment not found" });
    if (a.file_path) {
      const fp = path.join(__dirname, "../public", a.file_path);
      if (fs.existsSync(fp)) { try { fs.unlinkSync(fp); } catch (_) {} }
    }
    await db.promise().query("DELETE FROM course_assignments WHERE id = ? AND faculty_id = ?", [asgnId, fid]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

/* ════════════════ SUBMISSIONS & GRADING ════════════════ */

/* Get all submissions for an assignment */
router.get("/assignments/:asgn_id/submissions", async (req, res) => {
  const fid = req.session.user.id;
  const asgnId = req.params.asgn_id;
  try {
    // Verify faculty owns this assignment's course
    const [[a]] = await db.promise().query(
      "SELECT ca.id, ca.course_id, ca.title, ca.max_marks FROM course_assignments ca WHERE ca.id = ? AND ca.faculty_id = ?",
      [asgnId, fid]);
    if (!a) return res.json({ assignment: null, submitted: [], notSubmitted: [] });

    // Students who submitted
    const [submitted] = await db.promise().query(
      `SELECT cs.id AS sub_id, cs.student_id, cs.file_path, cs.text_answer,
              cs.submitted_at, cs.marks_obtained, cs.grade, cs.feedback,
              cs.graded_at, cs.status,
              u.username, u.email, u.prn, u.class_name
       FROM course_submissions cs JOIN users u ON cs.student_id = u.id
       WHERE cs.assignment_id = ?
       ORDER BY cs.submitted_at DESC`, [asgnId]);

    // Students who haven't submitted (enrolled but no submission)
    const [notSubmitted] = await db.promise().query(
      `SELECT u.id AS student_id, u.username, u.email, u.prn, u.class_name
       FROM course_enrollments ce JOIN users u ON ce.student_id = u.id
       WHERE ce.course_id = ?
         AND ce.student_id NOT IN (
           SELECT student_id FROM course_submissions WHERE assignment_id = ?
         )
       ORDER BY u.username`, [a.course_id, asgnId]);

    res.json({
      assignment: { id: a.id, title: a.title, max_marks: a.max_marks },
      submitted,
      notSubmitted
    });
  } catch (e) {
    console.error("[FACULTY-COURSES] submissions:", e.message);
    res.json({ assignment: null, submitted: [], notSubmitted: [] });
  }
});

/* Grade a submission */
router.post("/submissions/:sub_id/grade", async (req, res) => {
  const fid = req.session.user.id;
  const subId = req.params.sub_id;
  const { marks_obtained, grade, feedback } = req.body;

  if (marks_obtained === undefined || marks_obtained === null || marks_obtained === "")
    return res.json({ success: false, message: "Marks required" });

  try {
    // Verify this submission belongs to a course owned by this faculty
    const [[sub]] = await db.promise().query(
      `SELECT cs.id, cs.student_id, cs.assignment_id, ca.title AS asgn_title,
              c.title AS course_title, ca.max_marks
       FROM course_submissions cs
       JOIN course_assignments ca ON cs.assignment_id = ca.id
       JOIN courses c ON ca.course_id = c.id
       WHERE cs.id = ? AND ca.faculty_id = ?`, [subId, fid]);

    if (!sub) return res.json({ success: false, message: "Submission not found or not yours" });

    const marks = parseInt(marks_obtained);
    if (marks < 0 || marks > sub.max_marks)
      return res.json({ success: false, message: `Marks must be between 0 and ${sub.max_marks}` });

    await db.promise().query(
      `UPDATE course_submissions
       SET marks_obtained=?, grade=?, feedback=?, status='graded', graded_at=NOW(), graded_by=?
       WHERE id=?`,
      [marks, grade || null, feedback || null, fid, subId]);

    // Notify student
    await db.promise().query(
      "INSERT INTO notifications (user_id, message) VALUES (?,?)",
      [sub.student_id,
       `📊 Your submission for "${sub.asgn_title}" has been graded. Marks: ${marks}/${sub.max_marks}${grade ? ` (${grade})` : ""}. ${feedback ? `Feedback: ${feedback}` : ""}`]
    ).catch(() => {});

    res.json({ success: true });
  } catch (e) {
    console.error("[FACULTY-COURSES] grade:", e.message);
    res.json({ success: false, message: e.message });
  }
});

module.exports = router;