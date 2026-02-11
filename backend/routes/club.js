const express = require("express");
const router = express.Router();
const db = require("../db");
const path = require("path");
const auth = require("../middleware/authMiddleware");
const clubHeadOnly = require("../middleware/clubMiddleware");

// Apply auth + role check to all club routes
router.use(auth, clubHeadOnly);


/* =====================================================
   CLUB DASHBOARD PAGES
===================================================== */
router.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboards/club/club-dashboard.html"));
});

router.get("/members", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboards/club/club-members.html"));
});

router.get("/events", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboards/club/club-events.html"));
});

router.get("/announcements", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/dashboards/club/club-announcements.html"));
});


/* =====================================================
   GET MY CLUB DETAILS
===================================================== */
router.get("/details", async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [clubs] = await db.promise().query(
      `SELECT * FROM clubs WHERE club_head_id = ?`,
      [userId]
    );
    res.json(clubs[0] || null);
  } catch (err) {
    console.error("CLUB DETAILS ERROR:", err);
    res.json(null);
  }
});


/* =====================================================
   DASHBOARD SUMMARY DATA
===================================================== */
router.get("/data", async (req, res) => {
  const userId = req.session.user.id;

  try {
    const [clubs] = await db.promise().query(
      `SELECT * FROM clubs WHERE club_head_id = ?`,
      [userId]
    );

    if (!clubs.length) {
      return res.json({ name: req.session.user.username, clubName: "No Club Assigned", memberCount: 0, eventCount: 0, pendingCount: 0, announcementCount: 0 });
    }

    const club = clubs[0];

    const [[memberRow]] = await db.promise().query(
      `SELECT COUNT(*) AS count FROM user_clubs WHERE club_id = ? AND status = 'approved'`,
      [club.id]
    );
    const [[pendingRow]] = await db.promise().query(
      `SELECT COUNT(*) AS count FROM user_clubs WHERE club_id = ? AND status = 'pending'`,
      [club.id]
    );
    const [[eventRow]] = await db.promise().query(
      `SELECT COUNT(*) AS count FROM events WHERE club_id = ?`,
      [club.id]
    );
    const [[noticeRow]] = await db.promise().query(
      `SELECT COUNT(*) AS count FROM notices WHERE club_id = ?`,
      [club.id]
    );

    res.json({
      name: req.session.user.username,
      clubName: club.name,
      clubId: club.id,
      memberCount: memberRow.count,
      pendingCount: pendingRow.count,
      eventCount: eventRow.count,
      announcementCount: noticeRow.count
    });

  } catch (err) {
    console.error("CLUB DASH DATA ERROR:", err);
    res.json({ name: req.session.user.username, clubName: "Error", memberCount: 0, eventCount: 0, pendingCount: 0, announcementCount: 0 });
  }
});


/* =====================================================
   GET CLUB MEMBERS (APPROVED)
===================================================== */
router.get("/members/list", async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [clubs] = await db.promise().query(
      `SELECT id FROM clubs WHERE club_head_id = ?`, [userId]
    );
    if (!clubs.length) return res.json([]);
    const clubId = clubs[0].id;

    const [members] = await db.promise().query(
      `SELECT u.id, u.username, u.email, u.prn, u.class_name, u.current_year, uc.status, uc.id AS uc_id
       FROM user_clubs uc
       JOIN users u ON u.id = uc.user_id
       WHERE uc.club_id = ? AND uc.status = 'approved'
       ORDER BY u.username`,
      [clubId]
    );
    res.json(members);
  } catch (err) {
    console.error("MEMBERS ERROR:", err);
    res.json([]);
  }
});


/* =====================================================
   GET PENDING JOIN REQUESTS
===================================================== */
router.get("/members/requests", async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [clubs] = await db.promise().query(
      `SELECT id FROM clubs WHERE club_head_id = ?`, [userId]
    );
    if (!clubs.length) return res.json([]);
    const clubId = clubs[0].id;

    const [requests] = await db.promise().query(
      `SELECT u.id, u.username, u.email, u.prn, u.class_name, uc.id AS uc_id
       FROM user_clubs uc
       JOIN users u ON u.id = uc.user_id
       WHERE uc.club_id = ? AND uc.status = 'pending'
       ORDER BY uc.id DESC`,
      [clubId]
    );
    res.json(requests);
  } catch (err) {
    console.error("REQUESTS ERROR:", err);
    res.json([]);
  }
});


/* =====================================================
   APPROVE / REJECT JOIN REQUEST
===================================================== */
router.post("/members/respond", async (req, res) => {
  const userId = req.session.user.id;
  const { uc_id, action } = req.body; // action: 'approved' or 'rejected'

  if (!uc_id || !["approved", "rejected"].includes(action)) {
    return res.json({ success: false, message: "Invalid request" });
  }

  try {
    // Verify this club_head owns the club for this request
    const [check] = await db.promise().query(
      `SELECT uc.id FROM user_clubs uc
       JOIN clubs c ON c.id = uc.club_id
       WHERE uc.id = ? AND c.club_head_id = ?`,
      [uc_id, userId]
    );
    if (!check.length) return res.json({ success: false, message: "Unauthorized" });

    await db.promise().query(
      `UPDATE user_clubs SET status = ? WHERE id = ?`,
      [action, uc_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("RESPOND ERROR:", err);
    res.json({ success: false, message: err.message });
  }
});


/* =====================================================
   REMOVE MEMBER
===================================================== */
router.post("/members/remove", async (req, res) => {
  const userId = req.session.user.id;
  const { uc_id } = req.body;

  try {
    const [check] = await db.promise().query(
      `SELECT uc.id FROM user_clubs uc
       JOIN clubs c ON c.id = uc.club_id
       WHERE uc.id = ? AND c.club_head_id = ?`,
      [uc_id, userId]
    );
    if (!check.length) return res.json({ success: false, message: "Unauthorized" });

    await db.promise().query(`DELETE FROM user_clubs WHERE id = ?`, [uc_id]);
    res.json({ success: true });
  } catch (err) {
    console.error("REMOVE MEMBER ERROR:", err);
    res.json({ success: false });
  }
});


/* =====================================================
   CREATE CLUB EVENT
===================================================== */
router.post("/events/create", async (req, res) => {
  const userId = req.session.user.id;
  const { title, description, category, event_date, event_time, venue, seats } = req.body;

  if (!title || !event_date) {
    return res.json({ success: false, message: "Title and date required" });
  }

  try {
    const [clubs] = await db.promise().query(
      `SELECT id FROM clubs WHERE club_head_id = ?`, [userId]
    );
    if (!clubs.length) return res.json({ success: false, message: "No club found" });
    const clubId = clubs[0].id;

    await db.promise().query(
      `INSERT INTO events (title, description, category, event_date, event_time, venue, seats, club_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, category || "Cultural", event_date, event_time || null, venue || null, seats || null, clubId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("CREATE EVENT ERROR:", err);
    res.json({ success: false, message: err.message });
  }
});


/* =====================================================
   GET CLUB EVENTS
===================================================== */
router.get("/events/list", async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [clubs] = await db.promise().query(
      `SELECT id FROM clubs WHERE club_head_id = ?`, [userId]
    );
    if (!clubs.length) return res.json([]);
    const clubId = clubs[0].id;

    const [events] = await db.promise().query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM event_registrations WHERE event_id = e.id) AS registration_count
       FROM events e
       WHERE e.club_id = ?
       ORDER BY e.event_date DESC`,
      [clubId]
    );
    res.json(events);
  } catch (err) {
    console.error("EVENTS LIST ERROR:", err);
    res.json([]);
  }
});


/* =====================================================
   GET EVENT REGISTRATIONS
===================================================== */
router.get("/events/registrations/:eventId", async (req, res) => {
  const userId = req.session.user.id;
  const eventId = req.params.eventId;
  try {
    // Verify ownership
    const [check] = await db.promise().query(
      `SELECT e.id FROM events e
       JOIN clubs c ON c.id = e.club_id
       WHERE e.id = ? AND c.club_head_id = ?`,
      [eventId, userId]
    );
    if (!check.length) return res.json([]);

    const [regs] = await db.promise().query(
      `SELECT u.username, u.email, u.prn, u.class_name
       FROM event_registrations er
       JOIN users u ON u.id = er.user_id
       WHERE er.event_id = ?`,
      [eventId]
    );
    res.json(regs);
  } catch (err) {
    console.error("REGISTRATIONS ERROR:", err);
    res.json([]);
  }
});


/* =====================================================
   POST ANNOUNCEMENT (notice)
===================================================== */
router.post("/announcements/post", async (req, res) => {
  const userId = req.session.user.id;
  const { title } = req.body;

  if (!title) {
    return res.json({ success: false, message: "Announcement text required" });
  }

  try {
    const [clubs] = await db.promise().query(
      `SELECT id FROM clubs WHERE club_head_id = ?`, [userId]
    );
    if (!clubs.length) return res.json({ success: false, message: "No club found" });
    const clubId = clubs[0].id;

    await db.promise().query(
      `INSERT INTO notices (title, club_id, created_by) VALUES (?, ?, ?)`,
      [title, clubId, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("ANNOUNCEMENT ERROR:", err);
    res.json({ success: false, message: err.message });
  }
});


/* =====================================================
   GET CLUB ANNOUNCEMENTS
===================================================== */
router.get("/announcements/list", async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [clubs] = await db.promise().query(
      `SELECT id FROM clubs WHERE club_head_id = ?`, [userId]
    );
    if (!clubs.length) return res.json([]);
    const clubId = clubs[0].id;

    const [notices] = await db.promise().query(
      `SELECT * FROM notices WHERE club_id = ? ORDER BY id DESC`,
      [clubId]
    );
    res.json(notices);
  } catch (err) {
    res.json([]);
  }
});


/* =====================================================
   UPLOAD CLUB RESOURCE (link-based, no file upload)
===================================================== */
router.post("/resources/add", async (req, res) => {
  const userId = req.session.user.id;
  const { title, subject, type, file_path } = req.body;

  if (!title) return res.json({ success: false, message: "Title required" });

  try {
    const [clubs] = await db.promise().query(
      `SELECT id FROM clubs WHERE club_head_id = ?`, [userId]
    );
    if (!clubs.length) return res.json({ success: false, message: "No club found" });
    const clubId = clubs[0].id;

    await db.promise().query(
      `INSERT INTO resources (title, subject, type, file_path, uploaded_by, club_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, subject || null, type || "Notes", file_path || "#", userId, clubId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("RESOURCE ADD ERROR:", err);
    res.json({ success: false, message: err.message });
  }
});


/* =====================================================
   ANALYTICS
===================================================== */
router.get("/analytics", async (req, res) => {
  const userId = req.session.user.id;
  try {
    const [clubs] = await db.promise().query(
      `SELECT id, name FROM clubs WHERE club_head_id = ?`, [userId]
    );
    if (!clubs.length) return res.json({ memberCount: 0, pendingCount: 0, eventCount: 0, upcomingEvents: 0 });
    const clubId = clubs[0].id;

    const [[mc]] = await db.promise().query(
      `SELECT COUNT(*) AS count FROM user_clubs WHERE club_id = ? AND status = 'approved'`, [clubId]
    );
    const [[pc]] = await db.promise().query(
      `SELECT COUNT(*) AS count FROM user_clubs WHERE club_id = ? AND status = 'pending'`, [clubId]
    );
    const [[ec]] = await db.promise().query(
      `SELECT COUNT(*) AS count FROM events WHERE club_id = ?`, [clubId]
    );
    const [[ue]] = await db.promise().query(
      `SELECT COUNT(*) AS count FROM events WHERE club_id = ? AND event_date >= CURDATE()`, [clubId]
    );
    const [recentMembers] = await db.promise().query(
      `SELECT u.username, u.class_name FROM user_clubs uc
       JOIN users u ON u.id = uc.user_id
       WHERE uc.club_id = ? AND uc.status = 'approved'
       ORDER BY uc.id DESC LIMIT 5`,
      [clubId]
    );

    res.json({
      memberCount: mc.count,
      pendingCount: pc.count,
      eventCount: ec.count,
      upcomingEvents: ue.count,
      recentMembers
    });

  } catch (err) {
    console.error("ANALYTICS ERROR:", err);
    res.json({ memberCount: 0, pendingCount: 0, eventCount: 0, upcomingEvents: 0, recentMembers: [] });
  }
});


module.exports = router;