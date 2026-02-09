const express = require("express");
const router = express.Router();
const db = require("../db");
const path = require("path");

const auth = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");


/* =====================================================
   ADMIN DASHBOARD PAGE
===================================================== */
router.get("/", auth, adminOnly, (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboards/admin/admin.html"));

});


/* =====================================================
   CREATE NOTICE
===================================================== */
router.post("/admin/notice", auth, adminOnly, async (req, res) => {
  try {

    const { title } = req.body;

    if (!title) {
      return res.status(400).send("Notice title required");
    }

    await db.promise().query(
      "INSERT INTO notices (title) VALUES (?)",
      [title]
    );

    res.redirect("/admin");

  } catch (err) {

    console.error("🔥 NOTICE ERROR:", err);
    res.status(500).send(err.message);
  }
});


/* =====================================================
   CREATE EVENT
===================================================== */
router.post("/event", auth, adminOnly, async (req, res) => {
  try {

    const {
      title,
      description,
      category,
      event_date,
      event_time,
      venue = null,
      organizer = null,
      seats = null
    } = req.body;

    if (!title || !description || !category || !event_date || !event_time) {
      return res.status(400).send("Required event fields missing");
    }

    await db.promise().query(
      `INSERT INTO events
      (title, description, category, event_date, event_time, venue, organizer, seats)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, category, event_date, event_time, venue, organizer, seats]
    );

    res.redirect("/admin");

  } catch (err) {

    console.error("🔥 EVENT INSERT ERROR:", err);
    res.status(500).send(err.message);
  }
});


/* =====================================================
   ADD CLUB
===================================================== */
router.post("/club", auth, adminOnly, async (req, res) => {
  try {

    const { name } = req.body;

    if (!name) {
      return res.status(400).send("Club name required");
    }

    await db.promise().query(
      "INSERT INTO clubs (name) VALUES (?)",
      [name]
    );

    res.redirect("/admin");

  } catch (err) {

    console.error("🔥 CLUB ERROR:", err);
    res.status(500).send(err.message);
  }
});


/* =====================================================
   VIEW ALL EVENTS
===================================================== */
router.get("/admin/events", auth, adminOnly, async (req, res) => {
  try {

    const [events] = await db.promise().query(
      "SELECT * FROM events ORDER BY event_date DESC"
    );

    res.json(events);

  } catch (err) {

    console.error("🔥 FETCH EVENTS ERROR:", err);
    res.status(500).json([]);
  }
});


/* =====================================================
   DELETE EVENT
===================================================== */
router.post("/event/delete", auth, adminOnly, async (req, res) => {
  try {

    const { eventId } = req.body;

    if (!eventId) {
      return res.status(400).send("Event ID required");
    }

    await db.promise().query(
      "DELETE FROM events WHERE id=?",
      [eventId]
    );

    res.redirect("/admin");

  } catch (err) {

    console.error("🔥 DELETE EVENT ERROR:", err);
    res.status(500).send(err.message);
  }
});


/* =====================================================
   VIEW EVENT REGISTRATIONS
===================================================== */
router.get("/admin/event-registrations/:eventId", auth, adminOnly, async (req, res) => {
  try {

    const eventId = req.params.eventId;

    const [users] = await db.promise().query(
      `SELECT users.username, users.email
       FROM event_registrations
       JOIN users ON users.id = event_registrations.user_id
       WHERE event_id=?`,
      [eventId]
    );

    res.json(users);

  } catch (err) {

    console.error("🔥 REGISTRATION FETCH ERROR:", err);
    res.status( 500).json([]);
  } 
});


module.exports = router;
 