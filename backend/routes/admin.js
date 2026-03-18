"use strict";

const express         = require("express");
const router          = express.Router();
const db              = require("../db");
const path            = require("path");
const auth            = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");

router.use(auth, adminMiddleware);

/* ═══════════════════════════════════════════
   HTML PAGES
═══════════════════════════════════════════ */
router.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/admin/admin-dashboard.html")));
router.get("/users", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/admin/admin-users.html")));
router.get("/events", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/admin/admin-events.html")));
router.get("/analytics", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/admin/admin-analytics.html")));

/* ═══════════════════════════════════════════
   DASHBOARD DATA
═══════════════════════════════════════════ */
router.get("/data", async (req, res) => {
  try {
    const [[users]]         = await db.promise().query("SELECT COUNT(*) AS count FROM users");
    const [[events]]        = await db.promise().query("SELECT COUNT(*) AS count FROM events");
    const [[clubs]]         = await db.promise().query("SELECT COUNT(*) AS count FROM clubs");
    const [[registrations]] = await db.promise().query("SELECT COUNT(*) AS count FROM event_registrations");

    let resourceCount = 0;
    try {
      const [[r]] = await db.promise().query("SELECT COUNT(*) AS count FROM resources");
      resourceCount = r.count;
    } catch (_) {}

    const [recentUsers] = await db.promise().query(
      "SELECT id, username, email, role FROM users ORDER BY created_at DESC LIMIT 5"
    );

    let activity = [];
    try {
      const [rows] = await db.promise().query(
        `SELECT a.activity, a.created_at, u.username
         FROM activity_log a LEFT JOIN users u ON a.user_id = u.id
         ORDER BY a.created_at DESC LIMIT 10`
      );
      activity = rows;
    } catch (_) {}

    res.json({
      users: users.count, events: events.count,
      resources: resourceCount, clubs: clubs.count,
      registrations: registrations.count,
      recentUsers, activity
    });
  } catch (err) {
    console.error("[ADMIN /data]", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════
   USER LIST
═══════════════════════════════════════════ */
router.get("/users/list", async (req, res) => {
  try {
    const [users] = await db.promise().query(
      `SELECT id, username, email, role, status,
              prn, class_name, division, current_year, created_at
       FROM users ORDER BY created_at DESC`
    );

    let clubMap = {};
    try {
      const [clubRows] = await db.promise().query(
        `SELECT uc.user_id, c.name AS club_name, cp.name AS position_name
         FROM user_clubs uc
         JOIN clubs c ON uc.club_id = c.id
         LEFT JOIN club_positions cp ON uc.position_id = cp.id
         WHERE uc.status = 'approved'`
      );
      clubRows.forEach(r => { clubMap[r.user_id] = r; });
    } catch (e) { console.warn("[ADMIN] Club join skipped:", e.message); }

    res.json(users.map(u => ({
      id: u.id, username: u.username, email: u.email,
      role: u.role, created_at: u.created_at,
      prn: u.prn || null, class_name: u.class_name || null,
      division: u.division || null, current_year: u.current_year || null,
      is_active:     (u.status !== "inactive"),
      club_name:     (clubMap[u.id] || {}).club_name     || null,
      position_name: (clubMap[u.id] || {}).position_name || null,
    })));
  } catch (err) {
    console.error("[ADMIN] /users/list FATAL:", err.message);
    res.status(500).json([]);
  }
});

router.post("/users/role", async (req, res) => {
  const { user_id, role } = req.body;
  const valid = ["student","faculty","alumni","club_head","admin"];
  if (!user_id || !valid.includes(role))
    return res.status(400).json({ success: false, message: "Invalid parameters" });
  try {
    await db.promise().query("UPDATE users SET role=? WHERE id=?", [role, user_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/users/toggle", async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ success: false, message: "Missing user_id" });
  try {
    const [[u]] = await db.promise().query("SELECT status FROM users WHERE id=?", [user_id]);
    if (!u) return res.status(404).json({ success: false, message: "Not found" });
    const newStatus = (u.status === "inactive") ? "active" : "inactive";
    await db.promise().query("UPDATE users SET status=? WHERE id=?", [newStatus, user_id]);
    res.json({ success: true, is_active: newStatus === "active" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/users/delete", async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ success: false, message: "Missing user_id" });
  try {
    await db.promise().query("DELETE FROM users WHERE id=?", [user_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════
   CLUBS
═══════════════════════════════════════════ */
router.get("/clubs/list", async (req, res) => {
  try {
    const [clubs] = await db.promise().query(
      `SELECT c.id, c.name, c.category, u.username AS head_name,
              COUNT(DISTINCT uc.user_id) AS member_count
       FROM clubs c
       LEFT JOIN users u ON c.head_id = u.id
       LEFT JOIN user_clubs uc ON c.id = uc.club_id AND uc.status = 'approved'
       GROUP BY c.id ORDER BY c.name`
    );
    res.json(clubs);
  } catch (err) {
    res.status(500).json([]);
  }
});

router.get("/clubs/positions", async (req, res) => {
  try {
    const [p] = await db.promise().query("SELECT id, name FROM club_positions ORDER BY name");
    res.json(p);
  } catch (err) { res.json([]); }
});

router.post("/users/assign-club", async (req, res) => {
  const { user_id, club_id, position_id } = req.body;
  if (!user_id || !club_id)
    return res.json({ success: false, message: "Missing params" });
  try {
    const [[ex]] = await db.promise().query(
      "SELECT user_id FROM user_clubs WHERE user_id=? AND club_id=?", [user_id, club_id]
    );
    if (ex) {
      await db.promise().query(
        "UPDATE user_clubs SET status='approved', position_id=? WHERE user_id=? AND club_id=?",
        [position_id || null, user_id, club_id]
      );
    } else {
      await db.promise().query(
        "INSERT INTO user_clubs (user_id, club_id, status, position_id) VALUES (?,?,'approved',?)",
        [user_id, club_id, position_id || null]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════
   EVENTS
═══════════════════════════════════════════ */
router.post("/event", async (req, res) => {
  const { title, description, category,
          event_date, event_time, venue, organizer, seats } = req.body;
  if (!title?.trim()) return res.status(400).json({ success: false, message: "Title required" });
  if (!event_date)    return res.status(400).json({ success: false, message: "Date required" });
  try {
    const [r] = await db.promise().query(
      `INSERT INTO events
         (title, description, category, event_date, event_time, venue, organizer, seats)
       VALUES (?,?,?,?,?,?,?,?)`,
      [String(title).trim(), description||null, category||"General",
       event_date, event_time||null, venue||null, organizer||null,
       seats ? parseInt(seats) : null]
    );
    res.json({ success: true, event_id: r.insertId });
  } catch (err) {
    console.error("[ADMIN] Create event:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/events/list", async (req, res) => {
  try {
    const [events] = await db.promise().query(
      `SELECT e.*, COUNT(er.id) AS reg_count
       FROM events e LEFT JOIN event_registrations er ON e.id = er.event_id
       GROUP BY e.id ORDER BY e.event_date DESC, e.id DESC`
    );
    res.json(events);
  } catch (err) { res.status(500).json([]); }
});

router.get("/event-registrations/:event_id", async (req, res) => {
  try {
    const [regs] = await db.promise().query(
      `SELECT u.username, u.email, u.prn, u.class_name
       FROM event_registrations er JOIN users u ON er.user_id = u.id
       WHERE er.event_id = ?`, [req.params.event_id]
    );
    res.json(regs);
  } catch (err) { res.status(500).json([]); }
});

router.post("/event/delete", async (req, res) => {
  const { event_id } = req.body;
  if (!event_id) return res.json({ success: false });
  try {
    await db.promise().query("DELETE FROM event_registrations WHERE event_id=?", [event_id]);
    await db.promise().query("DELETE FROM events WHERE id=?", [event_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════
   NOTICES
   Actual schema: id, title, created_at,
                  club_id, created_by
   NO type column — removed from all queries
═══════════════════════════════════════════ */
router.post("/notice", async (req, res) => {
  const { title } = req.body;
  if (!title || !String(title).trim()) {
    return res.json({ success: false, message: "Notice text is empty" });
  }
  const text = String(title).trim();
  const uid  = req.session.user.id;

  console.log("[ADMIN] Posting notice:", text);

  try {
    /* notices schema: (id, title, created_at, club_id, created_by) */
    await db.promise().query(
      "INSERT INTO notices (title, created_by) VALUES (?, ?)",
      [text, uid]
    );
    console.log("[ADMIN] ✅ Notice posted");
    res.json({ success: true });
  } catch (err) {
    console.error("[ADMIN] ❌ Notice failed:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════
   ADD CLUB
═══════════════════════════════════════════ */
router.post("/club", async (req, res) => {
  const { name, category, description } = req.body;
  if (!name?.trim()) return res.json({ success: false, message: "Club name required" });
  try {
    await db.promise().query(
      "INSERT INTO clubs (name, category, description) VALUES (?,?,?)",
      [name.trim(), category || null, description || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Add club:", err.message);
    res.json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════
   ANALYTICS
═══════════════════════════════════════════ */
router.get("/system-analytics", async (req, res) => {
  try {
    const [roleDist]     = await db.promise().query("SELECT role, COUNT(*) AS c FROM users GROUP BY role");
    const [eventCat]     = await db.promise().query("SELECT category, COUNT(*) AS c FROM events GROUP BY category");
    const [topEvents]    = await db.promise().query(
      `SELECT e.title, COUNT(er.id) AS c FROM events e
       LEFT JOIN event_registrations er ON e.id = er.event_id
       GROUP BY e.id ORDER BY c DESC LIMIT 5`
    );
    const [monthlyUsers] = await db.promise().query(
      `SELECT DATE_FORMAT(created_at,'%b %Y') AS month, COUNT(*) AS c
       FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY MIN(created_at) ASC`
    );
    res.json({ roleDist, eventCat, topEvents, monthlyUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/activity", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT a.activity, a.created_at, u.username
       FROM activity_log a LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC LIMIT 50`
    );
    res.json(rows);
  } catch (err) { res.status(500).json([]); }
});

/* ═══════════════════════════════════════════
   NOTICES LIST (for dashboard display)
═══════════════════════════════════════════ */
router.get("/notices/list", async (req, res) => {
  try {
    const [notices] = await db.promise().query(
      `SELECT n.id, n.title, n.created_at, u.username AS posted_by
       FROM notices n
       LEFT JOIN users u ON n.created_by = u.id
       ORDER BY n.created_at DESC LIMIT 10`
    );
    res.json(notices);
  } catch (err) {
    res.status(500).json([]);
  }
});

module.exports = router;