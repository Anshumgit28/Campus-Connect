const express = require("express");
const router = express.Router();
const db = require("../db");
const path = require("path");
const auth = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

router.use(auth, adminOnly);

/* ── PAGES ── */
router.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/admin/admin-dashboard.html")));
router.get("/users", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/admin/admin-users.html")));
router.get("/events", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/admin/admin-events.html")));
router.get("/analytics", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/admin/admin-analytics.html")));

/* ── DASHBOARD DATA ── */
router.get("/data", async (req, res) => {
  try {
    const [[uc]] = await db.promise().query("SELECT COUNT(*) c FROM users");
    const [[ec]] = await db.promise().query("SELECT COUNT(*) c FROM events");
    const [[rc]] = await db.promise().query("SELECT COUNT(*) c FROM resources");
    const [[cc]] = await db.promise().query("SELECT COUNT(*) c FROM clubs");
    const [[nc]] = await db.promise().query("SELECT COUNT(*) c FROM notices");
    const [[regc]] = await db.promise().query("SELECT COUNT(*) c FROM event_registrations");
    const [recent] = await db.promise().query(
      "SELECT id, username, email, role, COALESCE(is_active,1) AS is_active FROM users ORDER BY id DESC LIMIT 5");
    const [activity] = await db.promise().query(
      "SELECT u.username, a.activity, a.created_at FROM activity_log a JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 10");
    res.json({ 
      users: uc.c, 
      events: ec.c, 
      resources: rc.c, 
      clubs: cc.c, 
      notices: nc.c, 
      registrations: regc.c, 
      recentUsers: recent, 
      activity 
    });
  } catch (e) { 
    console.error("ADMIN DATA ERROR:", e); 
    res.json({}); 
  }
});

/* ── ALL USERS ── */
router.get("/users/list", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT id, username, email, role, COALESCE(is_active,1) AS is_active, prn, class_name FROM users ORDER BY id DESC");
    res.json(rows);
  } catch (e) { 
    console.error("USERS LIST ERROR:", e); 
    res.json([]); 
  }
});

/* ── CHANGE ROLE ── */
router.post("/users/role", async (req, res) => {
  const { user_id, role } = req.body;
  const validRoles = ["student", "admin", "alumni", "faculty", "club_head"];
  if (!user_id || !validRoles.includes(role))
    return res.json({ success: false, message: "Invalid role or user" });
  try {
    await db.promise().query("UPDATE users SET role=? WHERE id=?", [role, user_id]);
    await db.promise().query(
      "INSERT INTO activity_log (user_id, activity) VALUES (?, ?)",
      [req.session.user.id, `Changed user ${user_id} role to ${role}`]
    );
    res.json({ success: true });
  } catch (e) { 
    console.error("ROLE CHANGE ERROR:", e); 
    res.json({ success: false, message: e.message }); 
  }
});

/* ── TOGGLE ACTIVE ── */
router.post("/users/toggle", async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.json({ success: false, message: "user_id required" });
  try {
    const [[current]] = await db.promise().query(
      "SELECT COALESCE(is_active,1) AS is_active FROM users WHERE id=?", 
      [user_id]
    );
    if (!current) return res.json({ success: false, message: "User not found" });
    
    const newStatus = current.is_active ? 0 : 1;
    await db.promise().query(
      "UPDATE users SET is_active=? WHERE id=?", 
      [newStatus, user_id]
    );
    
    res.json({ success: true, is_active: newStatus });
  } catch (e) { 
    console.error("TOGGLE ERROR:", e); 
    res.json({ success: false, message: e.message }); 
  }
});

/* ── DELETE USER (with FK cascade cleanup) ── */
router.post("/users/delete", async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.json({ success: false, message: "user_id required" });
  
  // Prevent self-deletion
  if (parseInt(user_id) === req.session.user.id) {
    return res.json({ success: false, message: "Cannot delete yourself" });
  }
  
  try {
    // Delete dependents in safe order before deleting the user
    await db.promise().query("DELETE FROM event_registrations WHERE user_id=?", [user_id]);
    await db.promise().query("DELETE FROM saved_resources WHERE user_id=?", [user_id]);
    await db.promise().query("DELETE FROM notifications WHERE user_id=?", [user_id]);
    await db.promise().query("DELETE FROM user_clubs WHERE user_id=?", [user_id]);
    await db.promise().query("DELETE FROM grades WHERE user_id=?", [user_id]);
    await db.promise().query("DELETE FROM attendance WHERE user_id=?", [user_id]);
    await db.promise().query("DELETE FROM activity_log WHERE user_id=?", [user_id]);
    await db.promise().query("DELETE FROM alumni_profiles WHERE user_id=?", [user_id]);
    await db.promise().query("DELETE FROM users WHERE id=?", [user_id]);
    res.json({ success: true });
  } catch (e) { 
    console.error("DELETE USER ERROR:", e); 
    res.json({ success: false, message: e.message }); 
  }
});

/* ── CREATE EVENT ── */
router.post("/event", async (req, res) => {
  const { title, description, category, event_date, event_time, venue, organizer, seats } = req.body;
  if (!title || !event_date)
    return res.json({ success: false, message: "Title and event date are required" });
  try {
    await db.promise().query(
      "INSERT INTO events (title, description, category, event_date, event_time, venue, organizer, seats, created_by) VALUES (?,?,?,?,?,?,?,?,?)",
      [title, description||null, category||null, event_date, event_time||null, venue||null, organizer||null, seats||null, req.session.user.id]
    );
    await db.promise().query(
      "INSERT INTO activity_log (user_id, activity) VALUES (?, ?)",
      [req.session.user.id, `Admin created event: ${title}`]
    );
    res.json({ success: true });
  } catch (e) { 
    console.error("CREATE EVENT ERROR:", e); 
    res.json({ success: false, message: e.message }); 
  }
});

/* ── ALL EVENTS ── */
router.get("/events/list", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT e.*, 
        (SELECT COUNT(*) FROM event_registrations WHERE event_id=e.id) AS reg_count 
       FROM events e ORDER BY event_date DESC`);
    res.json(rows);
  } catch (e) { 
    console.error("EVENTS LIST ERROR:", e); 
    res.json([]); 
  }
});

/* ── DELETE EVENT (cascade registrations first) ── */
router.post("/event/delete", async (req, res) => {
  const { event_id } = req.body;
  if (!event_id) return res.json({ success: false, message: "event_id required" });
  try {
    await db.promise().query("DELETE FROM event_registrations WHERE event_id=?", [event_id]);
    await db.promise().query("DELETE FROM events WHERE id=?", [event_id]);
    res.json({ success: true });
  } catch (e) { 
    console.error("DELETE EVENT ERROR:", e); 
    res.json({ success: false, message: e.message }); 
  }
});

/* ── EVENT REGISTRATIONS ── */
router.get("/event-registrations/:eventId", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT u.username, u.email, u.prn, u.class_name 
       FROM event_registrations er 
       JOIN users u ON u.id=er.user_id 
       WHERE er.event_id=?`,
      [req.params.eventId]);
    res.json(rows);
  } catch (e) { 
    console.error("EVENT REGISTRATIONS ERROR:", e); 
    res.json([]); 
  }
});

/* ── POST NOTICE ── */
router.post("/notice", async (req, res) => {
  const { title } = req.body;
  if (!title) return res.json({ success: false, message: "Title required" });
  try {
    await db.promise().query(
      "INSERT INTO notices (title, type, created_by) VALUES (?, 'global', ?)",
      [title, req.session.user.id]);
    res.json({ success: true });
  } catch (e) { 
    console.error("POST NOTICE ERROR:", e); 
    res.json({ success: false, message: e.message }); 
  }
});

/* ── ADD CLUB ── */
router.post("/club", async (req, res) => {
  const { name, description, category } = req.body;
  if (!name) return res.json({ success: false, message: "Club name required" });
  try {
    await db.promise().query(
      "INSERT INTO clubs (name, description, category) VALUES (?,?,?)",
      [name, description||null, category||null]);
    res.json({ success: true });
  } catch (e) { 
    console.error("ADD CLUB ERROR:", e); 
    res.json({ success: false, message: e.message }); 
  }
});

/* ── SYSTEM ANALYTICS ── */
router.get("/system-analytics", async (req, res) => {
  try {
    const [roleDist] = await db.promise().query(
      "SELECT role, COUNT(*) c FROM users GROUP BY role ORDER BY c DESC");
    
    const [eventCat] = await db.promise().query(
      "SELECT COALESCE(category,'Uncategorized') AS category, COUNT(*) c FROM events GROUP BY category ORDER BY c DESC");
    
    // ✅ FIXED: Add WHERE clause to filter null created_at
    const [monthlyUsers] = await db.promise().query(
      `SELECT DATE_FORMAT(created_at,'%b %Y') AS month, COUNT(*) c 
       FROM activity_log 
       WHERE created_at IS NOT NULL
       GROUP BY DATE_FORMAT(created_at,'%Y-%m') 
       ORDER BY DATE_FORMAT(created_at,'%Y-%m') DESC 
       LIMIT 6`);
    
    const [topEvents] = await db.promise().query(
      `SELECT e.title, COUNT(er.id) c 
       FROM event_registrations er 
       JOIN events e ON e.id=er.event_id 
       GROUP BY e.id, e.title
       ORDER BY c DESC LIMIT 5`);
    
    res.json({ roleDist, eventCat, monthlyUsers, topEvents });
  } catch (e) { 
    console.error("ANALYTICS ERROR:", e); 
    res.json({ roleDist:[], eventCat:[], monthlyUsers:[], topEvents:[] }); 
  }
});

/* ── ACTIVITY LOG ── */
router.get("/activity", async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT u.username, a.activity, a.created_at 
       FROM activity_log a 
       JOIN users u ON u.id=a.user_id 
       ORDER BY a.created_at DESC LIMIT 50`);
    res.json(rows);
  } catch (e) { 
    console.error("ACTIVITY LOG ERROR:", e); 
    res.json([]); 
  }
});

module.exports = router;