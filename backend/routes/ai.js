"use strict";
/**
 * AI RECOMMENDATION ROUTES
 * ========================
 * Uses ONLY existing tables from your project:
 *   - users          (username, email, class_name, current_year, role)
 *   - grades         (user_id, subject, grade)
 *   - attendance     (user_id, subject, attended, total)
 *
 * NO new database tables needed at all.
 * Semester is inferred from current_year (FE→1, SE→3, TE→5, BE→7)
 * Department is inferred from class_name (e.g. "TE IT" → Information Technology)
 */

const express = require("express");
const router  = express.Router();
const db      = require("../db");

const {
  generateRecommendations,
  globalSubjectSearch,
  getAllSubjectsForDept,
  getDepartments,
  CAREER_PATHS
} = require("../data/recommendation_engine");

const YEAR_TO_SEM = { FE: 1, SE: 3, TE: 5, BE: 7 };

const CLASS_TO_DEPT = {
  "IT":    "Information Technology",
  "CE":    "Computer Engineering",
  "COMP":  "Computer Engineering",
  "ENTC":  "Electronics & Telecommunication",
  "MECH":  "Mechanical Engineering",
  "CIVIL": "Civil Engineering",
  "CHEM":  "Chemical Engineering"
};

function semesterFromYear(yearStr) {
  if (!yearStr) return 1;
  const upper = yearStr.toString().toUpperCase().trim();
  if (YEAR_TO_SEM[upper]) return YEAR_TO_SEM[upper];
  const num = parseInt(upper);
  if (!isNaN(num) && num >= 1 && num <= 8) return num;
  return 1;
}

function deptFromClassName(className) {
  if (!className) return "Computer Engineering";
  const upper = className.toString().toUpperCase();
  for (const [suffix, dept] of Object.entries(CLASS_TO_DEPT)) {
    if (upper.includes(suffix)) return dept;
  }
  return "Computer Engineering";
}

function requireStudent(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: "Not logged in" });
  next();
}

async function getStudentContext(userId) {
  const [[user]] = await db.promise().query(
    `SELECT username, email, class_name, current_year FROM users WHERE id = ? AND role = 'student'`,
    [userId]
  );
  if (!user) return null;

  const [[attRow]] = await db.promise().query(
    `SELECT AVG(CASE WHEN total > 0 THEN (attended/total)*100 ELSE NULL END) AS avg_att FROM attendance WHERE user_id = ?`,
    [userId]
  ).catch(() => [[{ avg_att: null }]]);

  const [[gradeRow]] = await db.promise().query(
    `SELECT AVG(CASE grade WHEN 'A' THEN 10 WHEN 'B' THEN 8 WHEN 'C' THEN 6 WHEN 'D' THEN 5 WHEN 'F' THEN 0 ELSE NULL END) AS avg_gpa FROM grades WHERE user_id = ?`,
    [userId]
  ).catch(() => [[{ avg_gpa: null }]]);

  return {
    name:        user.username,
    email:       user.email,
    class_name:  user.class_name  || "Not set",
    current_year: user.current_year || "Not set",
    semester:    semesterFromYear(user.current_year),
    department:  deptFromClassName(user.class_name),
    gpa:         gradeRow?.avg_gpa ? parseFloat(parseFloat(gradeRow.avg_gpa).toFixed(1)) : 0,
    attendance:  attRow?.avg_att ? Math.round(attRow.avg_att) : 0
  };
}

router.get("/recommend", requireStudent, async (req, res) => {
  try {
    const ctx = await getStudentContext(req.session.userId);
    if (!ctx) return res.status(404).json({ error: "Student not found" });
    const result = generateRecommendations({ department: ctx.department, semester: ctx.semester, gpa: ctx.gpa, attendance: ctx.attendance, query: "", topN: 5 });
    return res.json({ ...result, student_context: ctx });
  } catch (err) {
    console.error("[AI RECOMMEND]", err.message);
    return res.status(500).json({ error: "AI recommendation failed" });
  }
});

router.post("/ask", requireStudent, async (req, res) => {
  try {
    const { query = "", semester, department } = req.body;
    if (!query || query.trim().length < 2) return res.status(400).json({ error: "Please type a question." });
    const ctx = await getStudentContext(req.session.userId);
    if (!ctx) return res.status(404).json({ error: "Student not found" });
    const activeSemester = semester   ? parseInt(semester)  : ctx.semester;
    const activeDept     = department || ctx.department;
    const result = generateRecommendations({ department: activeDept, semester: activeSemester, gpa: ctx.gpa, attendance: ctx.attendance, query: query.trim(), topN: 6 });
    return res.json({ ...result, student_context: { ...ctx, semester: activeSemester, department: activeDept } });
  } catch (err) {
    console.error("[AI ASK]", err.message);
    return res.status(500).json({ error: "AI query failed" });
  }
});

router.get("/departments", requireStudent, (req, res) => res.json({ departments: getDepartments() }));

router.get("/subjects", requireStudent, (req, res) => {
  const { semester, department = "Computer Engineering" } = req.query;
  if (!semester) return res.status(400).json({ error: "semester required" });
  const all = getAllSubjectsForDept(department);
  res.json({ semester: parseInt(semester), department, subjects: all.filter(s => s.semester === parseInt(semester)) });
});

router.post("/search", requireStudent, (req, res) => {
  const { query, department } = req.body;
  if (!query) return res.status(400).json({ error: "query required" });
  res.json({ results: globalSubjectSearch(query, department) });
});

router.get("/career-paths", requireStudent, (req, res) => res.json({ career_paths: CAREER_PATHS }));

module.exports = router;