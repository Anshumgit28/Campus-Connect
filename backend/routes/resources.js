const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../public/uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, Date.now() + "_" + safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    cb(null, allowed.includes(file.mimetype));
  }
});

/* ── GET RESOURCES ── */
router.get("/", auth, async (req, res) => {
  const { search, semester, type } = req.query;
  try {
    let sql = "SELECT * FROM resources WHERE 1=1";
    const params = [];
    
    if (search && search.trim()) {
      sql += " AND (title LIKE ? OR subject LIKE ?)";
      const term = "%" + search.trim() + "%";
      params.push(term, term);
    }
    if (semester) { 
      sql += " AND semester=?"; 
      params.push(semester); 
    }
    if (type) { 
      sql += " AND type=?"; 
      params.push(type); 
    }
    
    sql += " ORDER BY id DESC";
    const [rows] = await db.promise().query(sql, params);
    res.json(rows);
  } catch (e) { 
    console.error("RESOURCES LIST ERROR:", e); 
    res.json([]); 
  }
});

/* ── DOWNLOAD — FIXED WITH ABSOLUTE PATH ── */
router.get("/download/:id", auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).send("Invalid ID");
    }
    
    const [[r]] = await db.promise().query(
      "SELECT * FROM resources WHERE id=?", 
      [id]
    );
    
    if (!r) {
      return res.status(404).send("Resource not found");
    }

    // ✅ FIXED: Use absolute path
    const filePath = path.join(__dirname, "../public", r.file_path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File not found on server");
    }

    // Increment download count (fire-and-forget)
    db.promise().query(
      "UPDATE resources SET downloads = downloads + 1 WHERE id=?", 
      [id]
    ).catch(err => console.error("Download count update failed:", err));

    res.download(filePath);
  } catch (e) { 
    console.error("DOWNLOAD ERROR:", e); 
    res.status(500).send(e.message); 
  }
});

/* ── SAVE RESOURCE ── */
router.post("/save", auth, async (req, res) => {
  const { resourceId } = req.body;
  if (!resourceId) {
    return res.json({ success: false, message: "resourceId required" });
  }
  
  try {
    await db.promise().query(
      "INSERT IGNORE INTO saved_resources (user_id, resource_id) VALUES (?,?)",
      [req.session.user.id, resourceId]
    );
    res.json({ success: true });
  } catch (e) { 
    console.error("SAVE RESOURCE ERROR:", e); 
    res.json({ success: false, message: e.message }); 
  }
});

/* ── UNSAVE RESOURCE ── */
router.post("/unsave", auth, async (req, res) => {
  const { resourceId } = req.body;
  if (!resourceId) {
    return res.json({ success: false, message: "resourceId required" });
  }
  
  try {
    await db.promise().query(
      "DELETE FROM saved_resources WHERE user_id=? AND resource_id=?",
      [req.session.user.id, resourceId]
    );
    res.json({ success: true });
  } catch (e) { 
    console.error("UNSAVE RESOURCE ERROR:", e); 
    res.json({ success: false, message: e.message }); 
  }
});

/* ── SAVED LIST ── */
router.get("/saved", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT r.* FROM saved_resources sr 
       JOIN resources r ON r.id = sr.resource_id 
       WHERE sr.user_id=?
       ORDER BY sr.id DESC`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (e) { 
    console.error("SAVED RESOURCES ERROR:", e); 
    res.json([]); 
  }
});

/* ── UPLOAD (admin or faculty only) ── */
router.post("/upload", auth, (req, res, next) => {
  const role = req.session.user.role;
  if (role !== "admin" && role !== "faculty") {
    return res.status(403).json({ 
      success: false, 
      message: "Only admin and faculty can upload resources" 
    });
  }
  next();
}, upload.single("file"), async (req, res) => {
  const { title, subject, department, semester, type } = req.body;
  
  if (!req.file) {
    return res.json({ success: false, message: "No file uploaded" });
  }
  if (!title) {
    return res.json({ success: false, message: "Title required" });
  }
  
  try {
    await db.promise().query(
      "INSERT INTO resources (title, subject, department, semester, type, file_path, uploaded_by) VALUES (?,?,?,?,?,?,?)",
      [
        title, 
        subject||null, 
        department||null, 
        semester||null, 
        type||"Notes",
        "uploads/" + req.file.filename, 
        req.session.user.id
      ]
    );
    res.json({ success: true });
  } catch (e) { 
    console.error("UPLOAD ERROR:", e); 
    res.json({ success: false, message: e.message }); 
  }
});

module.exports = router;