"use strict";

const express           = require("express");
const router            = express.Router();
const db                = require("../db");
const path              = require("path");
const auth              = require("../middleware/authMiddleware");
const facultyMiddleware = require("../middleware/facultyMiddleware");

router.use(auth, facultyMiddleware);

/* ═══════════════════════════════════════════
   HTML PAGES
═══════════════════════════════════════════ */
router.get("/",          (req, res) => res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-dashboard.html")));
router.get("/students",  (req, res) => res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-students.html")));
router.get("/academics", (req, res) => res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-academics.html")));
router.get("/attendance",(req, res) => res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-attendance.html")));
router.get("/courses",   (req, res) => res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-courses.html")));
router.get("/course",    (req, res) => res.sendFile(path.join(__dirname, "../public/dashboards/faculty/faculty-course.html")));

/* ═══════════════════════════════════════════
   DASHBOARD SUMMARY
═══════════════════════════════════════════ */
router.get("/data", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [[profile]]  = await db.promise().query("SELECT username FROM users WHERE id=?", [uid]);
    const [[students]] = await db.promise().query("SELECT COUNT(*) c FROM users WHERE role='student' AND status != 'inactive'");

    let assignments = { c: 0 }, exams = { c: 0 }, grades = { c: 0 }, myCourses = { c: 0 };
    try { [[assignments]] = await db.promise().query("SELECT COUNT(*) c FROM assignments"); } catch(_) {}
    try { [[exams]]       = await db.promise().query("SELECT COUNT(*) c FROM exams"); }       catch(_) {}
    try { [[grades]]      = await db.promise().query("SELECT COUNT(*) c FROM grades"); }      catch(_) {}
    try { [[myCourses]]   = await db.promise().query("SELECT COUNT(*) c FROM courses WHERE faculty_id=?", [uid]); } catch(_) {}

    let activity = [];
    try {
      const [rows] = await db.promise().query(
        "SELECT activity, created_at FROM activity_log WHERE user_id=? ORDER BY created_at DESC LIMIT 8", [uid]);
      activity = rows;
    } catch (_) {}

    res.json({
      name: profile?.username || req.session.user.username,
      totalStudents:    students.c,
      totalAssignments: assignments.c,
      totalExams:       exams.c,
      totalGrades:      grades.c,
      myCourses:        myCourses.c,
      activity
    });
  } catch (e) {
    console.error("[FACULTY /data]", e.message);
    res.json({ name: req.session.user.username, totalStudents: 0, totalAssignments: 0, totalExams: 0, totalGrades: 0, myCourses: 0, activity: [] });
  }
});

/* ═══════════════════════════════════════════
   ANALYTICS
═══════════════════════════════════════════ */
router.get("/analytics", async (req, res) => {
  try {
    let avgAttendance = 0, gradeDist = [];
    try {
      const [[att]] = await db.promise().query(
        "SELECT ROUND(AVG(attended * 100.0 / NULLIF(total, 0)), 2) AS avg FROM attendance WHERE total > 0");
      avgAttendance = parseFloat(att.avg) || 0;
    } catch(_) {}
    try {
      const [rows] = await db.promise().query(
        "SELECT grade, COUNT(*) AS count FROM grades GROUP BY grade ORDER BY grade");
      gradeDist = rows;
    } catch(_) {}
    res.json({ avgAttendance, gradeDistribution: gradeDist });
  } catch (e) {
    res.json({ avgAttendance: 0, gradeDistribution: [] });
  }
});

/* ═══════════════════════════════════════════
   STUDENTS
═══════════════════════════════════════════ */
router.get("/students/list", async (req, res) => {
  try {
    const [students] = await db.promise().query(
      `SELECT id, username, email, prn, class_name, current_year
       FROM users WHERE role = 'student' AND status != 'inactive'
       ORDER BY class_name, username`
    );
    if (!students.length) return res.json([]);

    let gradeMap = {}, attMap = {};
    try {
      const [gr] = await db.promise().query(
        `SELECT user_id, ROUND(AVG(CASE grade WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 WHEN 'D' THEN 1 ELSE 0 END),2) AS gpa
         FROM grades GROUP BY user_id`);
      gr.forEach(r => { gradeMap[r.user_id] = r.gpa; });
    } catch(_) {}
    try {
      const [ar] = await db.promise().query(
        `SELECT user_id, ROUND(SUM(attended)*100.0/NULLIF(SUM(total),0),2) AS pct
         FROM attendance WHERE total > 0 GROUP BY user_id`);
      ar.forEach(r => { attMap[r.user_id] = r.pct; });
    } catch(_) {}

    res.json(students.map(s => ({
      ...s,
      gpa:        gradeMap[s.id] ?? null,
      attendance: attMap[s.id]   ?? 0
    })));
  } catch (e) {
    console.error("[FACULTY /students/list]", e.message);
    res.json([]);
  }
});

router.get("/students/performance", async (req, res) => {
  try {
    const [students] = await db.promise().query(
      `SELECT id, username, prn, class_name FROM users WHERE role='student' AND status != 'inactive' ORDER BY username`);
    if (!students.length) return res.json([]);
    let gradeMap = {}, attMap = {};
    try { const [gr] = await db.promise().query(`SELECT user_id, ROUND(AVG(CASE grade WHEN 'A' THEN 4 WHEN 'B' THEN 3 WHEN 'C' THEN 2 WHEN 'D' THEN 1 ELSE 0 END),2) AS gpa FROM grades GROUP BY user_id`); gr.forEach(r => { gradeMap[r.user_id] = r.gpa; }); } catch(_) {}
    try { const [ar] = await db.promise().query(`SELECT user_id, ROUND(SUM(attended)*100.0/NULLIF(SUM(total),0),2) AS pct FROM attendance WHERE total > 0 GROUP BY user_id`); ar.forEach(r => { attMap[r.user_id] = r.pct; }); } catch(_) {}
    res.json(students.map(s => ({ ...s, gpa: gradeMap[s.id] ?? null, attendance: attMap[s.id] ?? 0 })));
  } catch (e) { res.json([]); }
});

/* ═══════════════════════════════════════════
   COURSES — CRUD
═══════════════════════════════════════════ */

/* List all courses for this faculty — with enrollment key + counts */
router.get("/courses/my", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [courses] = await db.promise().query(
      `SELECT c.id, c.course_name AS name, c.course_code AS code, c.semester, c.description,
              c.enrollment_key, c.is_active,
              (SELECT COUNT(*) FROM course_batches    WHERE course_id=c.id) AS batch_count,
              (SELECT COUNT(*) FROM course_enrollments WHERE course_id=c.id) AS enrolled_count,
              (SELECT COUNT(*) FROM assignments        WHERE course_id=c.id) AS assignment_count
       FROM courses c WHERE c.faculty_id=? ORDER BY c.created_at DESC`,
      [uid]
    );
    res.json(courses);
  } catch (e) { res.json([]); }
});

/* Course detail with enrollment key */
router.get("/courses/detail/:course_id", async (req, res) => {
  const uid = req.session.user.id;
  const cid = req.params.course_id;
  try {
    const [[course]] = await db.promise().query(
      `SELECT c.id, c.course_name AS name, c.course_code AS code,
              c.semester, c.description, c.enrollment_key, c.is_active,
              (SELECT COUNT(*) FROM course_batches    WHERE course_id=c.id) AS batch_count,
              (SELECT COUNT(*) FROM course_enrollments WHERE course_id=c.id) AS enrolled_count,
              (SELECT COUNT(*) FROM assignments        WHERE course_id=c.id) AS assignment_count
       FROM courses c WHERE c.id=? AND c.faculty_id=?`,
      [cid, uid]
    );
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  } catch(e){ console.error("[FACULTY] Course detail:", e.message); res.status(500).json({ error: e.message }); }
});

/* Create course — generates enrollment key */
router.post("/courses/create", async (req, res) => {
  const uid = req.session.user.id;
  const { name, code, semester, description } = req.body;
  if (!name?.trim()) return res.json({ success: false, message: "Course name required" });

  // Generate unique 8-char enrollment key
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let enrollment_key = "";
  for (let i = 0; i < 8; i++) enrollment_key += chars[Math.floor(Math.random() * chars.length)];

  try {
    const [r] = await db.promise().query(
      "INSERT INTO courses (course_name, course_code, faculty_id, semester, description, enrollment_key) VALUES (?,?,?,?,?,?)",
      [name.trim(), code||null, uid, semester||null, description||null, enrollment_key]
    );
    try { await db.promise().query("INSERT INTO activity_log (user_id,activity) VALUES (?,?)",
      [uid, `Created course: ${name}`]); } catch(_) {}
    res.json({ success: true, course_id: r.insertId, enrollment_key });
  } catch (e) {
    // If enrollment_key column doesn't exist yet, try without it
    try {
      const [r] = await db.promise().query(
        "INSERT INTO courses (course_name, course_code, faculty_id, semester, description) VALUES (?,?,?,?,?)",
        [name.trim(), code||null, uid, semester||null, description||null]
      );
      res.json({ success: true, course_id: r.insertId });
    } catch(e2) {
      res.json({ success: false, message: e2.message });
    }
  }
});

/* Delete course */
router.post("/courses/delete", async (req, res) => {
  const uid = req.session.user.id;
  const { course_id } = req.body;
  try {
    await db.promise().query("DELETE FROM courses WHERE id=? AND faculty_id=?", [course_id, uid]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});
/* ============================================================
   ADD THIS ROUTE to backend/routes/faculty.js
   Place it after the existing router.post("/courses/delete") route
============================================================ */

/* Regenerate enrollment key for a course */
router.post("/courses/regenerate-key", async (req, res) => {
  const uid = req.session.user.id;
  const { course_id } = req.body;
  if (!course_id) return res.json({ success: false, message: "Course ID required" });

  try {
    // Verify ownership
    const [[course]] = await db.promise().query(
      "SELECT id FROM courses WHERE id=? AND faculty_id=?", [course_id, uid]
    );
    if (!course) return res.json({ success: false, message: "Course not found or unauthorized" });

    // Generate new key
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let enrollment_key = "";
    for (let i = 0; i < 8; i++) enrollment_key += chars[Math.floor(Math.random() * chars.length)];

    await db.promise().query(
      "UPDATE courses SET enrollment_key=? WHERE id=?", [enrollment_key, course_id]
    );

    res.json({ success: true, enrollment_key });
  } catch (e) {
    console.error("[FACULTY] Regenerate key:", e.message);
    res.json({ success: false, message: e.message });
  }
});
/* ═══════════════════════════════════════════
   COURSE STUDENTS (enrolled students with attendance)
═══════════════════════════════════════════ */
router.get("/courses/:course_id/students", async (req, res) => {
  const uid = req.session.user.id;
  const { course_id } = req.params;
  try {
    const [[course]] = await db.promise().query(
      "SELECT id FROM courses WHERE id=? AND faculty_id=?", [course_id, uid]);
    if (!course) return res.json([]);

    const [students] = await db.promise().query(
      `SELECT u.id, u.username, u.email, u.prn, u.class_name,
              b.name AS batch_name, b.type AS batch_type, ce.batch_id
       FROM course_enrollments ce
       JOIN users u ON ce.student_id = u.id
       LEFT JOIN course_batches b ON ce.batch_id = b.id
       WHERE ce.course_id = ?
       ORDER BY b.name, u.username`,
      [course_id]
    );

    const result = await Promise.all(students.map(async s => {
      let lec_pct = null, lab_pct = null;
      try {
        if (s.batch_id) {
          const [[lr]] = await db.promise().query(
            `SELECT COUNT(DISTINCT s.id) AS total,
                    SUM(CASE WHEN r.status IN ('present','late') THEN 1 ELSE 0 END) AS attended
             FROM attendance_sessions s
             LEFT JOIN attendance_records r ON r.session_id=s.id AND r.student_id=?
             WHERE s.course_id=? AND s.batch_id=? AND s.session_type='Lecture'`,
            [s.id, course_id, s.batch_id]
          );
          if (lr.total > 0) lec_pct = Math.round((lr.attended / lr.total) * 100);

          const [[labr]] = await db.promise().query(
            `SELECT COUNT(DISTINCT s.id) AS total,
                    SUM(CASE WHEN r.status IN ('present','late') THEN 1 ELSE 0 END) AS attended
             FROM attendance_sessions s
             LEFT JOIN attendance_records r ON r.session_id=s.id AND r.student_id=?
             WHERE s.course_id=? AND s.batch_id=? AND s.session_type='Lab'`,
            [s.id, course_id, s.batch_id]
          );
          if (labr.total > 0) lab_pct = Math.round((labr.attended / labr.total) * 100);
        }
      } catch(_) {}
      return { ...s, lec_pct, lab_pct };
    }));

    res.json(result);
  } catch (e) {
    console.error("[FACULTY /courses/:id/students]", e.message);
    res.json([]);
  }
});

/* ═══════════════════════════════════════════
   ASSIGNMENTS FOR A COURSE
═══════════════════════════════════════════ */
router.get("/courses/:course_id/assignments", async (req, res) => {
  const uid = req.session.user.id;
  const { course_id } = req.params;
  try {
    const [[course]] = await db.promise().query(
      "SELECT id FROM courses WHERE id=? AND faculty_id=?", [course_id, uid]);
    if (!course) return res.json([]);

    let rows = [];
    try {
      [rows] = await db.promise().query(
        `SELECT id, title, subject, description, due_date, max_marks, submission_type,
                (SELECT COUNT(*) FROM submissions WHERE assignment_id=assignments.id) AS submission_count
         FROM assignments WHERE course_id=? ORDER BY due_date ASC`,
        [course_id]
      );
    } catch(_) {
      [rows] = await db.promise().query(
        "SELECT id, title, subject, description, due_date FROM assignments WHERE course_id=? ORDER BY due_date ASC",
        [course_id]
      );
    }
    res.json(rows);
  } catch (e) {
    console.error("[FACULTY /courses/:id/assignments]", e.message);
    res.json([]);
  }
});

/* Add assignment to a course — with max_marks */
router.post("/courses/:course_id/assignments/add", async (req, res) => {
  const uid = req.session.user.id;
  const { course_id } = req.params;
  const { title, subject, description, due_date, max_marks, submission_type } = req.body;

  if (!title?.trim()) return res.json({ success: false, message: "Title is required" });
  if (!due_date)      return res.json({ success: false, message: "Due date is required" });
  if (!max_marks || parseInt(max_marks) < 1) return res.json({ success: false, message: "Max marks must be at least 1" });

  try {
    const [[course]] = await db.promise().query(
      "SELECT id, course_name FROM courses WHERE id=? AND faculty_id=?", [course_id, uid]);
    if (!course) return res.json({ success: false, message: "Course not found or unauthorised" });

    let insertId;
    try {
      const [r] = await db.promise().query(
        `INSERT INTO assignments (title, subject, description, due_date, course_id, max_marks, submission_type)
         VALUES (?,?,?,?,?,?,?)`,
        [title.trim(), subject||null, description||null, due_date, course_id,
         parseInt(max_marks), submission_type || "document"]
      );
      insertId = r.insertId;
    } catch(_) {
      // Fallback without optional columns
      const [r] = await db.promise().query(
        "INSERT INTO assignments (title, subject, description, due_date, course_id) VALUES (?,?,?,?,?)",
        [title.trim(), subject||null, description||null, due_date, course_id]
      );
      insertId = r.insertId;
    }

    try { await db.promise().query("INSERT INTO activity_log (user_id,activity) VALUES (?,?)",
      [uid, `Added assignment "${title}" to ${course.course_name}`]); } catch(_) {}

    res.json({ success: true, assignment_id: insertId });
  } catch (e) {
    console.error("[FACULTY /courses/:id/assignments/add]", e.message);
    res.json({ success: false, message: e.message });
  }
});

/* Delete assignment */
router.post("/assignments/:id/delete", async (req, res) => {
  const uid = req.session.user.id;
  const { id } = req.params;
  try {
    await db.promise().query("DELETE FROM assignments WHERE id=?", [id]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

/* ═══════════════════════════════════════════
   MARKS — AWARD + OVERVIEW
═══════════════════════════════════════════ */

/* Award marks to a student for an assignment */
router.post("/marks/award", async (req, res) => {
  const uid = req.session.user.id;
  const { assignment_id, student_id, marks_obtained, max_marks, feedback } = req.body;

  if (!assignment_id || !student_id || marks_obtained === undefined || marks_obtained === "")
    return res.json({ success: false, message: "Missing required fields" });

  try {
    // Verify faculty owns the course this assignment belongs to
    const [[assignment]] = await db.promise().query(
      `SELECT a.id, a.max_marks, a.course_id, a.title FROM assignments a
       JOIN courses c ON a.course_id = c.id
       WHERE a.id=? AND c.faculty_id=?`,
      [assignment_id, uid]
    );
    if (!assignment) return res.json({ success: false, message: "Unauthorized or assignment not found" });

    const finalMax    = parseFloat(max_marks) || assignment.max_marks || 10;
    const finalMarks  = parseFloat(marks_obtained);

    if (isNaN(finalMarks) || finalMarks < 0)
      return res.json({ success: false, message: "Invalid marks value" });
    if (finalMarks > finalMax)
      return res.json({ success: false, message: `Marks (${finalMarks}) cannot exceed max (${finalMax})` });

    // Get or create a submission record for this student
    let submissionId;
    const [[sub]] = await db.promise().query(
      "SELECT id FROM submissions WHERE assignment_id=? AND student_id=?",
      [assignment_id, student_id]
    );

    if (sub) {
      submissionId = sub.id;
    } else {
      // Create a placeholder submission (faculty entered marks directly)
      const [r] = await db.promise().query(
        `INSERT INTO submissions (assignment_id, student_id, text_content, submitted_at)
         VALUES (?,?, '(Marks entered by faculty)', NOW())`,
        [assignment_id, student_id]
      );
      submissionId = r.insertId;
    }

    // Upsert grade record
    await db.promise().query(
      `INSERT INTO submission_grades (submission_id, marks, max_marks, feedback, graded_by, graded_at)
       VALUES (?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE
         marks=VALUES(marks), max_marks=VALUES(max_marks),
         feedback=VALUES(feedback), graded_by=VALUES(graded_by), graded_at=NOW()`,
      [submissionId, finalMarks, finalMax, feedback||null, uid]
    );

    // Notify the student
    try {
      const pct = Math.round((finalMarks / finalMax) * 100);
      await db.promise().query(
        "INSERT INTO notifications (user_id, message) VALUES (?,?)",
        [student_id, `🎯 Your marks for "${assignment.title}": ${finalMarks}/${finalMax} (${pct}%)`]
      );
    } catch(_){}

    try { await db.promise().query(
      "INSERT INTO activity_log (user_id,activity) VALUES (?,?)",
      [uid, `Awarded marks ${finalMarks}/${finalMax} to student ${student_id}`]
    ); } catch(_){}

    res.json({ success: true });
  } catch(e){
    console.error("[FACULTY] Marks award:", e.message);
    res.json({ success: false, message: e.message });
  }
});

/* Marks overview for a course — optionally filtered by assignment */
router.get("/marks/overview/:course_id", async (req, res) => {
  const uid = req.session.user.id;
  const cid = req.params.course_id;
  const { assignment_id } = req.query;
  try {
    const [[course]] = await db.promise().query(
      "SELECT id FROM courses WHERE id=? AND faculty_id=?", [cid, uid]
    );
    if (!course) return res.json([]);

    let sql = `
      SELECT u.username, u.prn,
             a.title AS assignment_title, a.max_marks,
             sg.marks AS marks_obtained, sg.feedback, sg.graded_at
      FROM submission_grades sg
      JOIN submissions s ON sg.submission_id = s.id
      JOIN users u ON s.student_id = u.id
      JOIN assignments a ON s.assignment_id = a.id
      WHERE a.course_id = ?
    `;
    const params = [cid];
    if (assignment_id) { sql += " AND a.id = ?"; params.push(assignment_id); }
    sql += " ORDER BY a.due_date ASC, u.username ASC";

    const [rows] = await db.promise().query(sql, params);
    res.json(rows);
  } catch(e){
    console.error("[FACULTY] Marks overview:", e.message);
    res.json([]);
  }
});

/* ═══════════════════════════════════════════
   BATCHES
═══════════════════════════════════════════ */
router.get("/batches/:course_id", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [[course]] = await db.promise().query(
      "SELECT id FROM courses WHERE id=? AND faculty_id=?", [req.params.course_id, uid]);
    if (!course) return res.json([]);
    const [batches] = await db.promise().query(
      `SELECT b.id, b.name, b.type,
              COALESCE(b.division, '') AS division,
              b.course_id,
              (SELECT COUNT(*) FROM course_enrollments WHERE batch_id=b.id) AS student_count
       FROM course_batches b WHERE b.course_id=? ORDER BY b.type, b.name`,
      [req.params.course_id]);
    res.json(batches);
  } catch (e) { res.json([]); }
});

router.post("/batches/create", async (req, res) => {
  const uid = req.session.user.id;
  const { course_id, name, type, division } = req.body;
  if (!course_id || !name?.trim()) return res.json({ success: false, message: "Course and batch name required" });
  try {
    const [[course]] = await db.promise().query(
      "SELECT id FROM courses WHERE id=? AND faculty_id=?", [course_id, uid]);
    if (!course) return res.json({ success: false, message: "Unauthorised" });

    let r;
    try {
      [r] = await db.promise().query(
        "INSERT INTO course_batches (course_id, name, type, division) VALUES (?,?,?,?)",
        [course_id, name.trim(), type || "Lecture", division || null]);
    } catch(_) {
      // division column might not exist
      [r] = await db.promise().query(
        "INSERT INTO course_batches (course_id, name, type) VALUES (?,?,?)",
        [course_id, name.trim(), type || "Lecture"]);
    }
    res.json({ success: true, batch_id: r.insertId });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.post("/batches/delete", async (req, res) => {
  const uid = req.session.user.id;
  const { batch_id } = req.body;
  try {
    await db.promise().query(
      `DELETE cb FROM course_batches cb JOIN courses c ON cb.course_id=c.id
       WHERE cb.id=? AND c.faculty_id=?`, [batch_id, uid]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

/* ═══════════════════════════════════════════
   ATTENDANCE — SESSION BASED
═══════════════════════════════════════════ */
router.get("/attendance/batch-students/:batch_id", async (req, res) => {
  try {
    const [students] = await db.promise().query(
      `SELECT u.id, u.username, u.prn, u.class_name
       FROM course_enrollments ce JOIN users u ON ce.student_id = u.id
       WHERE ce.batch_id = ? ORDER BY u.username`, [req.params.batch_id]);
    res.json(students);
  } catch (e) { res.json([]); }
});

router.post("/attendance/session", async (req, res) => {
  const uid = req.session.user.id;
  const { course_id, batch_id, session_type, session_date, topic, records } = req.body;
  if (!course_id || !batch_id || !session_date || !records?.length)
    return res.json({ success: false, message: "Missing required fields" });
  try {
    const [[course]] = await db.promise().query(
      "SELECT id, course_name AS name FROM courses WHERE id=? AND faculty_id=?", [course_id, uid]);
    if (!course) return res.json({ success: false, message: "Unauthorised" });
    const [sess] = await db.promise().query(
      "INSERT INTO attendance_sessions (course_id, batch_id, session_type, session_date, topic, created_by) VALUES (?,?,?,?,?,?)",
      [course_id, batch_id, session_type || "Lecture", session_date, topic || null, uid]);
    const sessionId = sess.insertId;
    for (const rec of records) {
      await db.promise().query(
        `INSERT INTO attendance_records (session_id, student_id, status)
         VALUES (?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        [sessionId, rec.student_id, rec.status || "absent"]);
    }
    const present = records.filter(r => r.status === "present").length;
    const total   = records.length;
    try { await db.promise().query("INSERT INTO activity_log (user_id,activity) VALUES (?,?)",
      [uid, `Marked attendance: ${course.name} — ${present}/${total} present`]); } catch(_) {}
    res.json({ success: true, session_id: sessionId, present, total });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.get("/attendance/sessions/:course_id", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [[course]] = await db.promise().query(
      "SELECT id FROM courses WHERE id=? AND faculty_id=?", [req.params.course_id, uid]);
    if (!course) return res.json([]);
    const [sessions] = await db.promise().query(
      `SELECT s.id, s.session_date, s.session_type, s.topic, s.batch_id, s.course_id,
         b.name AS batch_name,
         COUNT(r.id) AS total_students,
         SUM(CASE WHEN r.status='present' THEN 1 ELSE 0 END) AS present_count,
         SUM(CASE WHEN r.status='late'    THEN 1 ELSE 0 END) AS late_count
       FROM attendance_sessions s
       JOIN course_batches b ON s.batch_id = b.id
       LEFT JOIN attendance_records r ON r.session_id = s.id
       WHERE s.course_id=? GROUP BY s.id ORDER BY s.session_date DESC`,
      [req.params.course_id]);
    res.json(sessions);
  } catch (e) { res.json([]); }
});

router.get("/attendance/session-records/:session_id", async (req, res) => {
  try {
    const [records] = await db.promise().query(
      `SELECT r.*, u.username, u.prn, u.class_name FROM attendance_records r
       JOIN users u ON r.student_id = u.id WHERE r.session_id=?`, [req.params.session_id]);
    res.json(records);
  } catch (e) { res.json([]); }
});

router.get("/attendance/summary/:course_id", async (req, res) => {
  try {
    const [summary] = await db.promise().query(
      `SELECT u.id, u.username, u.prn, b.name AS batch_name, b.type AS session_type,
         COUNT(DISTINCT s.id) AS total_sessions,
         SUM(CASE WHEN r.status IN ('present','late') THEN 1 ELSE 0 END) AS attended,
         ROUND(SUM(CASE WHEN r.status IN ('present','late') THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(DISTINCT s.id),0),1) AS pct
       FROM course_enrollments ce
       JOIN users u ON ce.student_id=u.id
       JOIN course_batches b ON ce.batch_id=b.id
       LEFT JOIN attendance_sessions s ON s.batch_id=b.id AND s.course_id=ce.course_id
       LEFT JOIN attendance_records r ON r.session_id=s.id AND r.student_id=u.id
       WHERE ce.course_id=? GROUP BY u.id, b.id ORDER BY b.name, u.username`,
      [req.params.course_id]);
    res.json(summary);
  } catch (e) { res.json([]); }
});

/* Legacy attendance */
router.post("/attendance/update", async (req, res) => {
  const { user_id, attended, total, subject, date } = req.body;
  if (!user_id || attended === undefined || !total)
    return res.json({ success: false, message: "Missing required fields" });
  try {
    await db.promise().query(
      "INSERT INTO attendance (user_id, subject, attended, total, date) VALUES (?,?,?,?,?)",
      [user_id, subject || null, attended, total, date || new Date()]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.post("/attendance/bulk", async (req, res) => {
  const { subject, date, records } = req.body;
  if (!subject || !records?.length)
    return res.json({ success: false, message: "Subject and records required" });
  let processed = 0;
  const failedPRNs = [];
  for (const record of records) {
    try {
      const [[user]] = await db.promise().query(
        "SELECT id FROM users WHERE prn=? AND role='student'", [record.prn]);
      if (!user) { failedPRNs.push(record.prn); continue; }
      await db.promise().query(
        "INSERT INTO attendance (user_id, subject, attended, total, date) VALUES (?,?,?,?,?)",
        [user.id, subject, record.attended, record.total, date || new Date()]);
      processed++;
    } catch (_) { failedPRNs.push(record.prn); }
  }
  res.json({ success: true, processed, failed: failedPRNs.length, failedPRNs });
});

router.get("/attendance/records", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT a.*, u.username FROM attendance a
       JOIN users u ON a.user_id=u.id ORDER BY a.id DESC LIMIT 100`);
    res.json(rows);
  } catch (e) { res.json([]); }
});

/* ═══════════════════════════════════════════
   GRADES (legacy)
═══════════════════════════════════════════ */
router.post("/grade/add", async (req, res) => {
  const { user_id, subject, grade } = req.body;
  if (!user_id || !subject || !grade) return res.json({ success: false, message: "All fields required" });
  try {
    await db.promise().query("INSERT INTO grades (user_id, subject, grade) VALUES (?,?,?)", [user_id, subject, grade]);
    try { await db.promise().query("INSERT INTO activity_log (user_id,activity) VALUES (?,?)",
      [req.session.user.id, `Entered grade ${grade} for student ${user_id} — ${subject}`]); } catch(_) {}
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.get("/grades/recent", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT g.id, g.grade, g.subject, u.username FROM grades g
       JOIN users u ON g.user_id=u.id ORDER BY g.id DESC LIMIT 20`);
    res.json(rows);
  } catch (e) { res.json([]); }
});

/* ═══════════════════════════════════════════
   LEGACY ASSIGNMENTS
═══════════════════════════════════════════ */
router.post("/assignment/add", async (req, res) => {
  const { title, subject, description, due_date, course_id } = req.body;
  if (!title || !due_date) return res.json({ success: false, message: "Title and date required" });
  try {
    await db.promise().query(
      "INSERT INTO assignments (title, subject, description, due_date, course_id) VALUES (?,?,?,?,?)",
      [title, subject || null, description || null, due_date, course_id || null]);
    try { await db.promise().query("INSERT INTO activity_log (user_id,activity) VALUES (?,?)",
      [req.session.user.id, `Added assignment: ${title}`]); } catch(_) {}
    res.json({ success: true });
  } catch (e) {
    try {
      await db.promise().query(
        "INSERT INTO assignments (title, subject, description, due_date) VALUES (?,?,?,?)",
        [title, subject || null, description || null, due_date]);
      res.json({ success: true });
    } catch (e2) { res.json({ success: false, message: e2.message }); }
  }
});

router.get("/assignments/list", async (req, res) => {
  try {
    let rows;
    try {
      [rows] = await db.promise().query(
        `SELECT a.id, a.title, a.subject, a.description, a.due_date, a.max_marks, c.course_name AS course_name
         FROM assignments a LEFT JOIN courses c ON a.course_id = c.id ORDER BY a.due_date DESC LIMIT 30`);
    } catch(_) {
      [rows] = await db.promise().query(
        "SELECT id, title, subject, description, due_date FROM assignments ORDER BY due_date DESC LIMIT 30");
    }
    res.json(rows);
  } catch (e) { res.json([]); }
});

/* ═══════════════════════════════════════════
   EXAMS
═══════════════════════════════════════════ */
router.post("/exam/add", async (req, res) => {
  const { subject, exam_date, exam_type } = req.body;
  if (!subject || !exam_date) return res.json({ success: false, message: "Subject and date required" });
  try {
    await db.promise().query(
      "INSERT INTO exams (subject, exam_date, exam_type) VALUES (?,?,?)",
      [subject, exam_date, exam_type || "Regular"]);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.get("/exams/list", async (req, res) => {
  try {
    let rows;
    try {
      [rows] = await db.promise().query(
        `SELECT e.id, e.subject, e.exam_date, e.exam_type, c.course_name AS course_name
         FROM exams e LEFT JOIN courses c ON e.course_id = c.id ORDER BY e.exam_date DESC LIMIT 30`);
    } catch(_) {
      [rows] = await db.promise().query("SELECT id, subject, exam_date, exam_type FROM exams ORDER BY exam_date DESC LIMIT 30");
    }
    res.json(rows);
  } catch (e) { res.json([]); }
});

/* ═══════════════════════════════════════════
   RESOURCES
═══════════════════════════════════════════ */
router.get("/resources/my", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM resources WHERE uploaded_by=? ORDER BY id DESC", [uid]);
    res.json(rows);
  } catch (e) { res.json([]); }
});

/* ═══════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════ */
router.post("/notify", async (req, res) => {
  const { message, target_role } = req.body;
  const uid = req.session.user.id;
  if (!message?.trim()) return res.json({ success: false, message: "Message required" });
  if (message.length > 500) return res.json({ success: false, message: "Max 500 chars" });
  try {
    const [users] = await db.promise().query(
      "SELECT id FROM users WHERE role=? AND status != 'inactive'", [target_role || "student"]);
    if (!users.length) return res.json({ success: true, sent: 0 });
    await db.promise().query(
      "INSERT INTO notifications (user_id, message) VALUES ?",
      [users.map(u => [u.id, message])]);
    try { await db.promise().query(
      "INSERT INTO faculty_notifications (faculty_id, message, target_role) VALUES (?,?,?)",
      [uid, message, target_role || "student"]); } catch(_) {}
    res.json({ success: true, sent: users.length });
  } catch (e) { res.json({ success: false, message: e.message }); }
});

router.get("/notifications/sent", async (req, res) => {
  const uid = req.session.user.id;
  try {
    const [rows] = await db.promise().query(
      "SELECT message, target_role, created_at FROM faculty_notifications WHERE faculty_id=? ORDER BY created_at DESC LIMIT 20",
      [uid]).catch(() => [[]]);
    res.json(rows || []);
  } catch (e) { res.json([]); }
});

module.exports = router;