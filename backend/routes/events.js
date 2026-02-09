const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");


// =======================
// GET ALL UPCOMING EVENTS (WITH FILTER)  
// =======================
router.get("/", auth, (req, res) => {
  const category = req.query.category;

  let sql = `
    SELECT * FROM events 
    WHERE event_date >= CURDATE()
    ORDER BY event_date ASC
  `;

  let params = [];

  if (category && category !== "") {
    sql = `
      SELECT * FROM events 
      WHERE category=? 
      AND event_date >= CURDATE()
      ORDER BY event_date ASC
    `;
    params = [category];
  }

  db.query(sql, params, (err, events) => {
    if (err) {
      console.log("EVENT FETCH ERROR:", err);
      return res.json([]);
    }

    console.log("EVENTS SENT:", events.length);
    res.json(events);
  });
});


// =======================
// GET SINGLE EVENT DETAILS
// =======================
router.get("/events/:id", auth, (req, res) => {
  db.query("SELECT * FROM events WHERE id=?", [req.params.id], (err, result) => {
    if (err || result.length === 0) {
      console.log("EVENT NOT FOUND");
      return res.status(404).json({ error: "Event not found" });
    }
    res.json(result[0]);
  });
});


// =======================
// REGISTER FOR EVENT
// =======================
router.post("/events/register", auth, (req, res) => {
  const userId = req.session.user.id;
  const { eventId } = req.body;

  if (!eventId) {
    return res.json({ success: false, message: "Event ID missing" });
  }

  // Prevent duplicate registration
  db.query(
    "SELECT * FROM event_registrations WHERE user_id=? AND event_id=?",
    [userId, eventId],
    (err, existing) => {

      if (existing.length > 0) {
        return res.json({ success: false, message: "Already registered" });
      }

      db.query(
        "INSERT INTO event_registrations (user_id, event_id) VALUES (?, ?)",
        [userId, eventId],
        (err) => {
          if (err) {
            console.log("REGISTER ERROR:", err);
            return res.json({ success: false });
          }
          res.json({ success: true });
        }
      );
    }
  );
});


// =======================
// CANCEL EVENT REGISTRATION
// =======================
router.post("/events/cancel", auth, (req, res) => {
  const userId = req.session.user.id;
  const { eventId } = req.body;

  db.query(
    "DELETE FROM event_registrations WHERE user_id=? AND event_id=?",
    [userId, eventId],
    (err) => {
      if (err) {
        console.log("CANCEL ERROR:", err);
        return res.json({ success: false });
      }
      res.json({ success: true });
    }
  );
});


// =======================
// GET MY REGISTERED EVENTS
// =======================
router.get("/events/my", auth, (req, res) => {
  const userId = req.session.user.id;

  db.query(
    `SELECT events.* FROM event_registrations
     JOIN events ON events.id = event_registrations.event_id
     WHERE event_registrations.user_id=?`,
    [userId],
    (err, results) => {
      if (err) {
        console.log("MY EVENTS ERROR:", err);
        return res.json([]);
      }
      res.json(results);
    }
  );
});


// =======================
// ADMIN VIEW EVENT REGISTRATIONS
// =======================
router.get("/admin/event-registrations/:eventId", auth, adminOnly, (req, res) => {
  const eventId = req.params.eventId;

  db.query(
    `SELECT users.username, users.email 
     FROM event_registrations 
     JOIN users ON users.id = event_registrations.user_id 
     WHERE event_id=?`,
    [eventId],
    (err, users) => {
      if (err) {
        console.log("ADMIN REGISTRATION VIEW ERROR:", err);
        return res.json([]);
      }
      res.json(users);
    }
  );
});


module.exports = router;
   