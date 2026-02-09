const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");
const multer = require("multer");
const path = require("path");


// =======================
// MULTER STORAGE
// =======================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../public/uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {

    const allowed = [
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ];

    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF/PPT allowed"));
    }

  }
});



// =======================
// GET RESOURCES (SEARCH + FILTER)
// =======================

router.get("/", auth, async(req, res) => {
  console.log("SESSION:", req.session);
  console.log("USER:", req.session.user);

  const { search, semester, type } = req.query;

  let sql = "SELECT * FROM resources WHERE 1=1";
  let params = [];

  if (search) {
    sql += " AND title LIKE ?";
    params.push("%" + search + "%");
  }

  if (semester) {
    sql += " AND semester=?";
    params.push(semester);
  }

  if (type) {
    sql += " AND type=?";
    params.push(type);
  }

  sql += " ORDER BY created_at DESC";

  db.query(sql, params, (err, results) => {
    if (err) {
      console.log("RESOURCE FETCH ERROR:", err);
      return res.json([]);
    }

    res.json(results);
  });
});


// =======================
// DOWNLOAD RESOURCE
// =======================

router.get("/download/:id", auth, (req, res) => {

  db.query(
    "SELECT * FROM resources WHERE id=?",
    [req.params.id],
    (err, result) => {

      if (!result.length) return res.send("File not found");

      const resource = result[0];

      db.query(
        "UPDATE resources SET downloads = downloads + 1 WHERE id=?",
        [req.params.id]
      );

      res.download(
        path.join(__dirname, "../public", resource.file_path)
      );
    }
  );
});



// =======================
// SAVE / BOOKMARK
// =======================

router.post("/save", auth, (req, res) => {

  const userId = req.session.user.id;
  const { resourceId } = req.body;

  db.query(
    "INSERT IGNORE INTO saved_resources (user_id, resource_id) VALUES (?,?)",
    [userId, resourceId],
    () => {
      res.json({ success: true });
    }
  );
});


// =======================
// GET SAVED
// =======================

router.get("/resources/saved", auth, (req, res) => {

  const userId = req.session.user.id;

  db.query(`
    SELECT resources.*
    FROM saved_resources
    JOIN resources
    ON resources.id = saved_resources.resource_id
    WHERE saved_resources.user_id=?
  `,
  [userId],
  (err, results) => {
    res.json(results);
  });

});


// =======================
// ADMIN UPLOAD
// =======================

router.post(
  "/admin/resource",
  auth,
  adminOnly,
  upload.single("file"),
  (req, res) => {

    const {
      title,
      subject,
      department,
      semester,
      type
    } = req.body;

    const filePath = "uploads/" + req.file.filename;

    db.query(`
      INSERT INTO resources
      (title, subject, department, semester, type, file_path, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      title,
      subject,
      department,
      semester,
      type,
      filePath,
      req.session.user.id
    ], 
    (err) =>  {

      if (err) {
        console.log("UPLOAD ERROR:", err);
        return res.send("Upload failed");
      }

      res.redirect("/admin");
    }); 

  }
);

module.exports = router;
