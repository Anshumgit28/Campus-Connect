"use strict";
const express = require("express");
const router  = express.Router();
const db      = require("../db");
const path    = require("path");
const fs      = require("fs");
const multer  = require("multer");
const auth    = require("../middleware/authMiddleware");
router.use(auth);

function ensureDir(d){ if(!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true}); }

const assignStorage = multer.diskStorage({
  destination: (req,file,cb)=>{ const d=path.join(__dirname,"../public/uploads/assignments"); ensureDir(d); cb(null,d); },
  filename: (req,file,cb)=>cb(null,`${Date.now()}_${file.originalname.replace(/\s+/g,"_")}`)
});
const submitStorage = multer.diskStorage({
  destination: (req,file,cb)=>{ const d=path.join(__dirname,"../public/uploads/submissions"); ensureDir(d); cb(null,d); },
  filename: (req,file,cb)=>cb(null,`${Date.now()}_${file.originalname.replace(/\s+/g,"_")}`)
});
const allowedMimes = ["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/zip","image/png","image/jpeg","text/plain","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation"];
const uploadAssign = multer({ storage:assignStorage, limits:{fileSize:20*1024*1024}, fileFilter:(req,file,cb)=>cb(null,allowedMimes.includes(file.mimetype)) });
const uploadSubmit = multer({ storage:submitStorage, limits:{fileSize:20*1024*1024}, fileFilter:(req,file,cb)=>cb(null,allowedMimes.includes(file.mimetype)) });

// FACULTY: list assignments for course
router.get("/faculty/courses/:course_id/assignments", async (req,res)=>{
  if(req.session.user.role!=="faculty") return res.status(403).json({error:"Faculty only"});
  const uid=req.session.user.id; const {course_id}=req.params;
  try {
    const [[course]]=await db.promise().query("SELECT id FROM courses WHERE id=? AND faculty_id=?",[course_id,uid]);
    if(!course) return res.json([]);
    const [rows]=await db.promise().query(`SELECT a.*,(SELECT COUNT(*) FROM submissions WHERE assignment_id=a.id) AS submission_count FROM assignments a WHERE a.course_id=? ORDER BY a.due_date ASC`,[course_id]);
    res.json(rows);
  } catch(e){ res.json([]); }
});

// FACULTY: add assignment with optional file upload
router.post("/faculty/courses/:course_id/assignments/add", uploadAssign.single("file"), async (req,res)=>{
  if(req.session.user.role!=="faculty") return res.status(403).json({error:"Faculty only"});
  const uid=req.session.user.id; const {course_id}=req.params;
  const {title,description,due_date,max_marks,submission_type}=req.body;
  if(!title?.trim()) return res.json({success:false,message:"Title required"});
  if(!due_date) return res.json({success:false,message:"Due date required"});
  try {
    const [[course]]=await db.promise().query("SELECT id,course_name FROM courses WHERE id=? AND faculty_id=?",[course_id,uid]);
    if(!course) return res.json({success:false,message:"Unauthorised"});
    const file_path=req.file?`uploads/assignments/${req.file.filename}`:null;
    const [r]=await db.promise().query(
      "INSERT INTO assignments (course_id,title,description,due_date,max_marks,submission_type,file_path,created_by) VALUES (?,?,?,?,?,?,?,?)",
      [course_id,title.trim(),description||null,due_date,max_marks?parseInt(max_marks):100,submission_type||"file",file_path,uid]);
    try{ await db.promise().query("INSERT INTO activity_log (user_id,activity) VALUES (?,?)",[uid,`Added assignment "${title}" to ${course.course_name}`]); }catch(_){}
    res.json({success:true,assignment_id:r.insertId});
  } catch(e){ console.error("[ASSIGN] add:",e.message); res.json({success:false,message:e.message}); }
});

// FACULTY: delete assignment
router.post("/faculty/assignments/:id/delete", async (req,res)=>{
  if(req.session.user.role!=="faculty") return res.status(403).json({error:"Faculty only"});
  const uid=req.session.user.id; const {id}=req.params;
  try {
    const [[a]]=await db.promise().query("SELECT a.file_path FROM assignments a JOIN courses c ON a.course_id=c.id WHERE a.id=? AND c.faculty_id=?",[id,uid]);
    if(a?.file_path){ const fp=path.join(__dirname,"../public",a.file_path); if(fs.existsSync(fp)) fs.unlinkSync(fp); }
    await db.promise().query("DELETE FROM assignments WHERE id=?",[id]);
    res.json({success:true});
  } catch(e){ res.json({success:false,message:e.message}); }
});

// Download assignment file
router.get("/assignments/file/:id", async (req,res)=>{
  try {
    const [[a]]=await db.promise().query("SELECT file_path FROM assignments WHERE id=?",[req.params.id]);
    if(!a?.file_path) return res.status(404).send("File not found");
    const fp=path.join(__dirname,"../public",a.file_path);
    if(!fs.existsSync(fp)) return res.status(404).send("Not on disk");
    res.download(fp);
  } catch(e){ res.status(500).send(e.message); }
});

// STUDENT: submit assignment
router.post("/submissions/submit", uploadSubmit.single("file"), async (req,res)=>{
  const uid=req.session.user.id;
  const {assignment_id,text_content}=req.body;
  if(!assignment_id) return res.json({success:false,message:"Assignment ID required"});
  try {
    const [[enrolled]]=await db.promise().query(
      "SELECT ce.id FROM course_enrollments ce JOIN assignments a ON a.course_id=ce.course_id WHERE a.id=? AND ce.student_id=?",[assignment_id,uid]);
    if(!enrolled) return res.json({success:false,message:"Not enrolled in this course"});
    const file_path=req.file?`uploads/submissions/${req.file.filename}`:null;
    await db.promise().query(
      "INSERT INTO submissions (assignment_id,student_id,file_path,text_content) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE file_path=VALUES(file_path),text_content=VALUES(text_content),submitted_at=NOW()",
      [assignment_id,uid,file_path,text_content||null]);
    try{ await db.promise().query("INSERT INTO activity_log (user_id,activity) VALUES (?,?)",[uid,`Submitted assignment ID ${assignment_id}`]); }catch(_){}
    res.json({success:true});
  } catch(e){ console.error("[SUBMIT]:",e.message); res.json({success:false,message:e.message}); }
});

// FACULTY: view submissions for assignment
router.get("/submissions/:assignment_id/list", async (req,res)=>{
  if(req.session.user.role!=="faculty") return res.status(403).json({error:"Faculty only"});
  const uid=req.session.user.id; const {assignment_id}=req.params;
  try {
    const [[check]]=await db.promise().query("SELECT c.id FROM assignments a JOIN courses c ON a.course_id=c.id WHERE a.id=? AND c.faculty_id=?",[assignment_id,uid]);
    if(!check) return res.json([]);
    const [rows]=await db.promise().query(
      `SELECT s.id,s.student_id,s.file_path,s.text_content,s.submitted_at,u.username,u.prn,u.class_name,sg.marks,sg.feedback,sg.graded_at
       FROM submissions s JOIN users u ON s.student_id=u.id LEFT JOIN submission_grades sg ON sg.submission_id=s.id
       WHERE s.assignment_id=? ORDER BY s.submitted_at DESC`,[assignment_id]);
    res.json(rows);
  } catch(e){ res.json([]); }
});

// Download submission file
router.get("/submissions/file/:id", async (req,res)=>{
  const uid=req.session.user.id;
  try {
    const [[s]]=await db.promise().query(
      "SELECT s.file_path,s.student_id,c.faculty_id FROM submissions s JOIN assignments a ON s.assignment_id=a.id JOIN courses c ON a.course_id=c.id WHERE s.id=?",[req.params.id]);
    if(!s?.file_path) return res.status(404).send("File not found");
    if(s.student_id!==uid && s.faculty_id!==uid && req.session.user.role!=="admin") return res.status(403).send("Forbidden");
    const fp=path.join(__dirname,"../public",s.file_path);
    if(!fs.existsSync(fp)) return res.status(404).send("Not on disk");
    res.download(fp);
  } catch(e){ res.status(500).send(e.message); }
});

// FACULTY: grade submission
router.post("/submissions/grade", async (req,res)=>{
  if(req.session.user.role!=="faculty") return res.status(403).json({error:"Faculty only"});
  const uid=req.session.user.id;
  const {submission_id,marks,feedback}=req.body;
  if(!submission_id || marks===undefined || marks==="") return res.json({success:false,message:"submission_id and marks required"});
  try {
    const [[check]]=await db.promise().query(
      "SELECT c.id FROM submissions s JOIN assignments a ON s.assignment_id=a.id JOIN courses c ON a.course_id=c.id WHERE s.id=? AND c.faculty_id=?",[submission_id,uid]);
    if(!check) return res.json({success:false,message:"Unauthorised"});
    await db.promise().query(
      "INSERT INTO submission_grades (submission_id,marks,feedback,graded_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE marks=VALUES(marks),feedback=VALUES(feedback),graded_by=VALUES(graded_by),graded_at=NOW()",
      [submission_id,parseFloat(marks),feedback||null,uid]);
    res.json({success:true});
  } catch(e){ console.error("[GRADE]:",e.message); res.json({success:false,message:e.message}); }
});

module.exports = router;