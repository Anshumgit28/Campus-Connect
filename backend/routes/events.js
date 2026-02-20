const express = require("express");
const router  = express.Router();
const db      = require("../db");
const auth    = require("../middleware/authMiddleware");

/* ── MY REGISTERED EVENTS — MUST BE BEFORE /:id ── */
router.get("/my/registered", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT e.id, e.title, e.event_date, e.event_time, e.venue, e.category
       FROM event_registrations er
       JOIN events e ON e.id = er.event_id
       WHERE er.user_id = ?
       ORDER BY e.event_date ASC`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error("MY EVENTS ERROR:", e);
    res.json([]);
  }
});

/* ── ALL UPCOMING EVENTS ── */
router.get("/", auth, async (req, res) => {
  const { category } = req.query;
  try {
    let sql = "SELECT * FROM events WHERE event_date >= CURDATE()";
    const params = [];
    if (category) { 
      sql += " AND category = ?"; 
      params.push(category); 
    }
    sql += " ORDER BY event_date ASC";
    const [rows] = await db.promise().query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("EVENTS LIST ERROR:", e);
    res.json([]);
  }
});

/* ── REGISTER FOR EVENT ── */
router.post("/register", auth, async (req, res) => {
  const { eventId } = req.body;
  const uid = req.session.user.id;

  if (!eventId) return res.json({ success: false, message: "Event ID missing" });

  try {
    // Check already registered
    const [existing] = await db.promise().query(
      "SELECT id FROM event_registrations WHERE user_id = ? AND event_id = ?",
      [uid, eventId]
    );
    if (existing.length) {
      return res.json({ success: false, message: "Already registered" });
    }

    // Check seat availability
    const [[event]] = await db.promise().query(
      "SELECT seats FROM events WHERE id = ?", 
      [eventId]
    );
    if (!event) {
      return res.json({ success: false, message: "Event not found" });
    }

    if (event.seats !== null) {
      const [[regCount]] = await db.promise().query(
        "SELECT COUNT(*) c FROM event_registrations WHERE event_id = ?", 
        [eventId]
      );
      if (regCount.c >= event.seats) {
        return res.json({ success: false, message: "Event is full" });
      }
    }

    // Register
    await db.promise().query(
      "INSERT INTO event_registrations (user_id, event_id) VALUES (?, ?)",
      [uid, eventId]
    );
    
    // Log activity
    await db.promise().query(
      "INSERT INTO activity_log (user_id, activity) VALUES (?, ?)",
      [uid, `Registered for event ID ${eventId}`]
    );

    res.json({ success: true });
  } catch (e) {
    console.error("REGISTER ERROR:", e);
    res.json({ success: false, message: e.message });
  }
});

/* ── CANCEL REGISTRATION ── */
router.post("/cancel", auth, async (req, res) => {
  const { eventId } = req.body;
  if (!eventId) return res.json({ success: false, message: "Event ID missing" });
  
  try {
    await db.promise().query(
      "DELETE FROM event_registrations WHERE user_id = ? AND event_id = ?",
      [req.session.user.id, eventId]
    );
    res.json({ success: true });
  } catch (e) {
    console.error("CANCEL ERROR:", e);
    res.json({ success: false });
  }
});

/* ── SINGLE EVENT — WILDCARD MUST BE LAST ── */
router.get("/:id", auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    
    const [[row]] = await db.promise().query(
      "SELECT * FROM events WHERE id = ?", 
      [id]
    );
    
    if (!row) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    res.json(row);
  } catch (e) {
    console.error("EVENT FETCH ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;