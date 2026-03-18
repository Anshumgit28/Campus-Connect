"use strict";
const express = require("express");
const router  = express.Router();
const db      = require("../db");
const auth    = require("../middleware/authMiddleware");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");

router.use(auth);

/* ── MULTER SETUP FOR ASSIGNMENT SUBMISSIONS ── */
const uploadDir = path.join(__dirname, "../public/uploads/submissions");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `sub_${Date.now()}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|ppt|pptx|txt|zip|rar/i;
    if (allowed.test(path.extname(file.originalname))) cb(null, true);
    else cb(new Error("File type not allowed"));
  }
});

/* ══════════════════════════════════════════
   BROWSE ALL COURSES (for student)
══════════════════════════════════════════ */
router.get("/", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [courses] = await db.promise().query(
      `SELECT c.id, c.course_name AS name, c.course_code AS code, c.semester, c.description,
              u.username AS faculty_name,
              (SELECT COUNT(*) FROM course_enrollments WHERE course_id=c.id) AS enrolled_count,
              (SELECT COUNT(*) FROM course_batches WHERE course_id=c.id) AS batch_count,
              (SELECT COUNT(*) FROM course_enrollments WHERE course_id=c.id AND student_id=?) AS is_enrolled,
              (SELECT cb.name FROM course_batches cb JOIN course_enrollments ce2 ON ce2.batch_id=cb.id WHERE ce2.course_id=c.id AND ce2.student_id=? LIMIT 1) AS my_batch_name
       FROM courses c JOIN users u ON c.faculty_id=u.id WHERE c.is_active=1 GROUP BY c.id ORDER BY c.semester, c.course_name`,
      [uid, uid]);
    res.json(courses);
  } catch(e){ console.error("[COURSES] Browse:", e.message); res.json([]); }
});

/* ══════════════════════════════════════════
   COURSE DETAIL (student view)
══════════════════════════════════════════ */
router.get("/detail/:course_id", async (req, res) => {
  const uid = req.session.user.id;
  const cid = req.params.course_id;
  try {
    const [[course]] = await db.promise().query(
      `SELECT c.id, c.course_name AS name, c.course_code AS code, c.semester, c.description,
              u.username AS faculty_name,
              ce.batch_id,
              cb.name AS batch_name, cb.type AS batch_type
       FROM courses c
       JOIN users u ON c.faculty_id = u.id
       JOIN course_enrollments ce ON ce.course_id = c.id AND ce.student_id = ?
       LEFT JOIN course_batches cb ON ce.batch_id = cb.id
       WHERE c.id = ?`,
      [uid, cid]
    );

    if (!course) return res.json({ error: "Not enrolled or course not found" });

    // Lecture attendance
    let lec_pct = null, lab_pct = null, pending_assignments = 0;
    try {
      if (course.batch_id) {
        const [[lr]] = await db.promise().query(
          `SELECT COUNT(DISTINCT s.id) AS total,
                  SUM(CASE WHEN r.status IN ('present','late') THEN 1 ELSE 0 END) AS attended
           FROM attendance_sessions s
           LEFT JOIN attendance_records r ON r.session_id=s.id AND r.student_id=?
           WHERE s.course_id=? AND s.batch_id=? AND s.session_type='Lecture'`,
          [uid, cid, course.batch_id]
        );
        if (lr.total > 0) lec_pct = Math.round((lr.attended / lr.total) * 100);

        const [[labr]] = await db.promise().query(
          `SELECT COUNT(DISTINCT s.id) AS total,
                  SUM(CASE WHEN r.status IN ('present','late') THEN 1 ELSE 0 END) AS attended
           FROM attendance_sessions s
           LEFT JOIN attendance_records r ON r.session_id=s.id AND r.student_id=?
           WHERE s.course_id=? AND s.batch_id=? AND s.session_type='Lab'`,
          [uid, cid, course.batch_id]
        );
        if (labr.total > 0) lab_pct = Math.round((labr.attended / labr.total) * 100);
      }
    } catch(_) {}

    try {
      const [[pa]] = await db.promise().query(
        `SELECT COUNT(*) AS c FROM assignments a
         WHERE a.course_id=? AND a.due_date >= CURDATE()
           AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id=a.id AND s.student_id=?)`,
        [cid, uid]
      );
      pending_assignments = pa.c;
    } catch(_) {}

    res.json({ ...course, lec_pct, lab_pct, pending_assignments });
  } catch(e){ console.error("[COURSES] Detail:", e.message); res.json({}); }
});

/* ══════════════════════════════════════════
   ENROLL BY KEY
══════════════════════════════════════════ */
router.post("/enroll-by-key", async (req, res) => {
  const uid = req.session.user.id;
  const { enrollment_key } = req.body;
  if (!enrollment_key?.trim()) return res.json({ success: false, message: "Enrollment key is required" });
  try {
    const [[course]] = await db.promise().query(
      "SELECT id, course_name, is_active FROM courses WHERE enrollment_key=?",
      [enrollment_key.trim().toUpperCase()]
    );
    if (!course) return res.json({ success: false, message: "Invalid enrollment key — course not found" });
    if (!course.is_active) return res.json({ success: false, message: "This course is not currently active" });

    const [[existing]] = await db.promise().query(
      "SELECT id FROM course_enrollments WHERE student_id=? AND course_id=?", [uid, course.id]
    );
    if (existing) return res.json({ success: false, message: "You are already enrolled in this course" });

    await db.promise().query(
      "INSERT INTO course_enrollments (student_id, course_id) VALUES (?,?)", [uid, course.id]
    );
    try { await db.promise().query("INSERT INTO activity_log (user_id,activity) VALUES (?,?)",
      [uid, `Enrolled in course: ${course.course_name}`]); } catch(_){}

    res.json({ success: true, course_name: course.course_name, course_id: course.id });
  } catch(e){
    if (e.code === "ER_DUP_ENTRY") return res.json({ success: false, message: "Already enrolled" });
    console.error("[COURSES] Enroll by key:", e.message);
    res.json({ success: false, message: e.message });
  }
});

/* ══════════════════════════════════════════
   DIRECT ENROLL (without key)
══════════════════════════════════════════ */
router.post("/enroll", async (req, res) => {
  const uid = req.session.user.id;
  const { course_id, batch_id } = req.body;
  if (!course_id) return res.json({ success: false, message: "Course ID required" });
  try {
    const [[existing]] = await db.promise().query(
      "SELECT id FROM course_enrollments WHERE student_id=? AND course_id=?", [uid, course_id]
    );
    if (existing) return res.json({ success: false, message: "Already enrolled" });
    if (batch_id) {
      const [[batch]] = await db.promise().query(
        "SELECT id FROM course_batches WHERE id=? AND course_id=?", [batch_id, course_id]
      );
      if (!batch) return res.json({ success: false, message: "Invalid batch" });
    }
    await db.promise().query(
      "INSERT INTO course_enrollments (student_id, course_id, batch_id) VALUES (?,?,?)",
      [uid, course_id, batch_id||null]
    );
    res.json({ success: true });
  } catch(e){
    if (e.code === "ER_DUP_ENTRY") return res.json({ success: false, message: "Already enrolled" });
    res.json({ success: false, message: e.message });
  }
});

/* ══════════════════════════════════════════
   UNENROLL
══════════════════════════════════════════ */
router.post("/unenroll", async (req, res) => {
  const uid = req.session.user.id;
  const { course_id } = req.body;
  try {
    await db.promise().query(
      "DELETE FROM course_enrollments WHERE student_id=? AND course_id=?", [uid, course_id]
    );
    res.json({ success: true });
  } catch(e){ res.json({ success: false, message: e.message }); }
});

/* ══════════════════════════════════════════
   MY ENROLLED COURSES (with attendance stats)
══════════════════════════════════════════ */
router.get("/my", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [enrollments] = await db.promise().query(
      `SELECT c.id, c.course_name AS name, c.course_code AS code, c.semester, c.description,
              u.username AS faculty_name, b.name AS batch_name, b.type AS batch_type, ce.batch_id
       FROM course_enrollments ce
       JOIN courses c ON ce.course_id=c.id
       JOIN users u ON c.faculty_id=u.id
       LEFT JOIN course_batches b ON ce.batch_id=b.id
       WHERE ce.student_id=?
       ORDER BY c.semester, c.course_name`,
      [uid]
    );
    if (!enrollments.length) return res.json([]);

    const result = await Promise.all(enrollments.map(async c => {
      let lec_total=0, lec_attended=0, lab_total=0, lab_attended=0, pending_assignments=0;
      try {
        if (c.batch_id) {
          [[{lec_total}]]    = await db.promise().query(`SELECT COUNT(DISTINCT s.id) AS lec_total FROM attendance_sessions s WHERE s.course_id=? AND s.batch_id=? AND s.session_type='Lecture'`,[c.id, c.batch_id]);
          [[{lec_attended}]] = await db.promise().query(`SELECT COUNT(r.id) AS lec_attended FROM attendance_records r JOIN attendance_sessions s ON r.session_id=s.id WHERE s.course_id=? AND s.batch_id=? AND s.session_type='Lecture' AND r.student_id=? AND r.status IN ('present','late')`,[c.id, c.batch_id, uid]);
          [[{lab_total}]]    = await db.promise().query(`SELECT COUNT(DISTINCT s.id) AS lab_total FROM attendance_sessions s WHERE s.course_id=? AND s.batch_id=? AND s.session_type='Lab'`,[c.id, c.batch_id]);
          [[{lab_attended}]] = await db.promise().query(`SELECT COUNT(r.id) AS lab_attended FROM attendance_records r JOIN attendance_sessions s ON r.session_id=s.id WHERE s.course_id=? AND s.batch_id=? AND s.session_type='Lab' AND r.student_id=? AND r.status IN ('present','late')`,[c.id, c.batch_id, uid]);
        }
      } catch(_){}
      try {
        [[{pending_assignments}]] = await db.promise().query(
          `SELECT COUNT(*) AS pending_assignments FROM assignments a
           WHERE a.course_id=? AND a.due_date>=CURDATE()
             AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id=a.id AND s.student_id=?)`,
          [c.id, uid]
        );
      } catch(_){}
      return {
        ...c,
        lec_total, lec_attended,
        lec_pct: lec_total > 0 ? Math.round(lec_attended/lec_total*100) : null,
        lab_total, lab_attended,
        lab_pct: lab_total > 0 ? Math.round(lab_attended/lab_total*100) : null,
        pending_assignments
      };
    }));
    res.json(result);
  } catch(e){ console.error("[COURSES] My:", e.message); res.json([]); }
});

/* ══════════════════════════════════════════
   BATCHES FOR A COURSE
══════════════════════════════════════════ */
router.get("/:course_id/batches", async (req, res) => {
  try {
    const cid = parseInt(req.params.course_id);
    if (isNaN(cid)) return res.json([]);
    const [batches] = await db.promise().query(
      `SELECT b.id, b.name, b.type, b.course_id,
              (SELECT COUNT(*) FROM course_enrollments WHERE batch_id=b.id) AS student_count
       FROM course_batches b WHERE b.course_id=? ORDER BY b.type, b.name`,
      [cid]
    );
    res.json(batches);
  } catch(e){ res.json([]); }
});

/* ══════════════════════════════════════════
   ASSIGNMENTS FOR A COURSE (student view — with submission status)
══════════════════════════════════════════ */
router.get("/:course_id/assignments", async (req, res) => {
  const uid = req.session.user.id;
  const cid = req.params.course_id;
  try {
    const [rows] = await db.promise().query(
      `SELECT
         a.id, a.title, a.description, a.subject, a.due_date,
         a.max_marks, a.submission_type,
         s.id AS submission_id,
         s.file_path AS submission_file,
         s.text_content,
         s.submitted_at,
         sg.marks,
         sg.feedback,
         sg.graded_at
       FROM assignments a
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
       LEFT JOIN submission_grades sg ON sg.submission_id = s.id
       WHERE a.course_id = ?
       ORDER BY a.due_date ASC`,
      [uid, cid]
    );
    res.json(rows);
  } catch(e){ console.error("[COURSES] Assignments:", e.message); res.json([]); }
});

/* ══════════════════════════════════════════
   SUBMIT ASSIGNMENT (student)
══════════════════════════════════════════ */
router.post("/submit-assignment", upload.single("file"), async (req, res) => {
  const uid = req.session.user.id;
  const { assignment_id, text_content } = req.body;
  const file_path = req.file ? `/uploads/submissions/${req.file.filename}` : null;

  if (!assignment_id) return res.json({ success: false, message: "Assignment ID required" });
  if (!text_content?.trim() && !file_path)
    return res.json({ success: false, message: "Please provide text or a file" });

  try {
    // Check assignment exists and student is enrolled
    const [[assignment]] = await db.promise().query(
      `SELECT a.id, a.course_id FROM assignments a
       JOIN course_enrollments ce ON ce.course_id = a.course_id AND ce.student_id = ?
       WHERE a.id = ?`,
      [uid, assignment_id]
    );
    if (!assignment) return res.json({ success: false, message: "Assignment not found or not enrolled" });

    // Check already submitted
    const [[existing]] = await db.promise().query(
      "SELECT id FROM submissions WHERE assignment_id=? AND student_id=?", [assignment_id, uid]
    );
    if (existing) {
      // Update submission
      await db.promise().query(
        "UPDATE submissions SET text_content=?, file_path=?, submitted_at=NOW() WHERE id=?",
        [text_content?.trim() || null, file_path, existing.id]
      );
      return res.json({ success: true, message: "Submission updated" });
    }

    // New submission
    await db.promise().query(
      "INSERT INTO submissions (assignment_id, student_id, text_content, file_path) VALUES (?,?,?,?)",
      [assignment_id, uid, text_content?.trim() || null, file_path]
    );

    try {
      await db.promise().query(
        "INSERT INTO activity_log (user_id, activity) VALUES (?,?)",
        [uid, `Submitted assignment ID ${assignment_id}`]
      );
    } catch(_){}

    res.json({ success: true });
  } catch(e){
    console.error("[COURSES] Submit:", e.message);
    res.json({ success: false, message: e.message });
  }
});

/* ══════════════════════════════════════════
   MY ATTENDANCE FOR A COURSE
══════════════════════════════════════════ */
router.get("/:course_id/my-attendance", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [sessions] = await db.promise().query(
      `SELECT s.id, s.session_date, s.session_type, s.topic,
              COALESCE(r.status, 'absent') AS status
       FROM attendance_sessions s
       JOIN course_enrollments ce ON ce.course_id = s.course_id AND ce.student_id = ?
       LEFT JOIN attendance_records r ON r.session_id = s.id AND r.student_id = ?
       WHERE s.course_id = ?
       ORDER BY s.session_date DESC`,
      [uid, uid, req.params.course_id]
    );
    res.json(sessions);
  } catch(e){ res.json([]); }
});

/* ══════════════════════════════════════════
   MY MARKS FOR A COURSE
══════════════════════════════════════════ */
router.get("/:course_id/my-marks", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [rows] = await db.promise().query(
      `SELECT
         a.title AS assignment_title,
         a.max_marks,
         sg.marks,
         sg.feedback,
         sg.graded_at,
         s.submitted_at
       FROM assignments a
       JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
       JOIN submission_grades sg ON sg.submission_id = s.id
       WHERE a.course_id = ?
       ORDER BY sg.graded_at DESC`,
      [uid, req.params.course_id]
    );
    res.json(rows);
  } catch(e){ res.json([]); }
});

/* ══════════════════════════════════════════
   MY GRADES (old endpoint — still needed)
══════════════════════════════════════════ */
router.get("/:course_id/my-grades", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [rows] = await db.promise().query(
      `SELECT a.title, a.max_marks, s.submitted_at, sg.marks, sg.feedback, sg.graded_at
       FROM assignments a
       JOIN submissions s ON s.assignment_id=a.id AND s.student_id=?
       JOIN submission_grades sg ON sg.submission_id=s.id
       WHERE a.course_id=?
       ORDER BY sg.graded_at DESC`,
      [uid, req.params.course_id]
    );
    res.json(rows);
  } catch(e){ res.json([]); }
});

module.exports = router;