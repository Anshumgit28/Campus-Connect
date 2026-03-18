"use strict";

const express      = require("express");
const router       = express.Router();
const db           = require("../db");
const path         = require("path");
const auth         = require("../middleware/authMiddleware");
const clubMiddleware = require("../middleware/clubMiddleware");

router.use(auth);

/* ═══════════════════════════════════════════
   HTML PAGES
═══════════════════════════════════════════ */
router.get("/", clubMiddleware, (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/club/club-dashboard.html")));

router.get("/members", clubMiddleware, (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/club/club-members.html")));

router.get("/events", clubMiddleware, (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/club/club-events.html")));

router.get("/announcements", clubMiddleware, (req, res) =>
  res.sendFile(path.join(__dirname, "../public/dashboards/club/club-announcements.html")));

/* ═══════════════════════════════════════════
   DASHBOARD DATA
   Fixes:
   - notices has no `type` column
   - user_clubs has no `id` or `created_at`
═══════════════════════════════════════════ */
router.get("/data", clubMiddleware, async (req, res) => {
  const uid = req.session.user.id;

  try {
    const [[club]] = await db.promise().query(
      "SELECT id, name FROM clubs WHERE head_id = ?", [uid]
    );

    if (!club) {
      return res.json({
        name: req.session.user.username,
        clubName: "No club assigned",
        memberCount: 0, pendingCount: 0,
        eventCount: 0, announcementCount: 0
      });
    }

    const [
      [[members]],
      [[pending]],
      [[events]],
      [[announcements]]
    ] = await Promise.all([
      db.promise().query(
        "SELECT COUNT(*) AS count FROM user_clubs WHERE club_id = ? AND status = 'approved'",
        [club.id]
      ),
      db.promise().query(
        "SELECT COUNT(*) AS count FROM user_clubs WHERE club_id = ? AND status = 'pending'",
        [club.id]
      ),
      db.promise().query(
        "SELECT COUNT(*) AS count FROM events WHERE organizer = ?",
        [club.name]
      ),
      /* notices has no type column — count by club_id instead */
      db.promise().query(
        "SELECT COUNT(*) AS count FROM notices WHERE created_by = ?",
        [uid]
      )
    ]);

    res.json({
      name:              req.session.user.username,
      clubName:          club.name,
      memberCount:       members.count,
      pendingCount:      pending.count,
      eventCount:        events.count,
      announcementCount: announcements.count
    });

  } catch (err) {
    console.error("Club data error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════
   ANALYTICS
   user_clubs has no joined_at column —
   removed ORDER BY uc.joined_at
═══════════════════════════════════════════ */
router.get("/analytics", clubMiddleware, async (req, res) => {
  const uid = req.session.user.id;

  try {
    const [[club]] = await db.promise().query(
      "SELECT id FROM clubs WHERE head_id = ?", [uid]
    );

    if (!club) {
      return res.json({ memberCount: 0, pendingCount: 0, upcomingEvents: 0, recentMembers: [] });
    }

    const [
      [[members]],
      [[pending]],
      [[upcoming]],
      [recent]
    ] = await Promise.all([
      db.promise().query(
        "SELECT COUNT(*) AS count FROM user_clubs WHERE club_id = ? AND status = 'approved'",
        [club.id]
      ),
      db.promise().query(
        "SELECT COUNT(*) AS count FROM user_clubs WHERE club_id = ? AND status = 'pending'",
        [club.id]
      ),
      db.promise().query(
        `SELECT COUNT(*) AS count FROM events
         WHERE organizer = (SELECT name FROM clubs WHERE id = ?)
         AND event_date >= CURDATE()`,
        [club.id]
      ),
      /* user_clubs has no joined_at — order by user_id DESC as fallback */
      db.promise().query(
        `SELECT u.username, u.class_name
         FROM user_clubs uc
         JOIN users u ON uc.user_id = u.id
         WHERE uc.club_id = ? AND uc.status = 'approved'
         ORDER BY uc.user_id DESC
         LIMIT 5`,
        [club.id]
      )
    ]);

    res.json({
      memberCount:    members.count,
      pendingCount:   pending.count,
      upcomingEvents: upcoming.count,
      recentMembers:  recent
    });

  } catch (err) {
    console.error("Club analytics error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════
   MEMBER MANAGEMENT
   user_clubs has no id column, no created_at —
   use (user_id, club_id) as composite key
   uc_id sent to frontend is actually user_id
═══════════════════════════════════════════ */
router.get("/members/requests", clubMiddleware, async (req, res) => {
  const uid = req.session.user.id;

  try {
    const [[club]] = await db.promise().query(
      "SELECT id FROM clubs WHERE head_id = ?", [uid]
    );
    if (!club) return res.json([]);

    /* No id/created_at in user_clubs — use user_id as uc_id */
    const [requests] = await db.promise().query(
      `SELECT uc.user_id AS uc_id, u.username, u.email, u.prn, u.class_name
       FROM user_clubs uc
       JOIN users u ON uc.user_id = u.id
       WHERE uc.club_id = ? AND uc.status = 'pending'`,
      [club.id]
    );
    res.json(requests);

  } catch (err) {
    console.error("Load requests error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/members/list", clubMiddleware, async (req, res) => {
  const uid = req.session.user.id;

  try {
    const [[club]] = await db.promise().query(
      "SELECT id FROM clubs WHERE head_id = ?", [uid]
    );
    if (!club) return res.json([]);

    /* uc_id = user_id (no id column in user_clubs) */
    const [members] = await db.promise().query(
      `SELECT uc.user_id AS uc_id, u.username, u.email, u.prn, u.class_name, u.current_year
       FROM user_clubs uc
       JOIN users u ON uc.user_id = u.id
       WHERE uc.club_id = ? AND uc.status = 'approved'`,
      [club.id]
    );
    res.json(members);

  } catch (err) {
    console.error("Load members error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* respond uses uc_id which is actually user_id now */
router.post("/members/respond", clubMiddleware, async (req, res) => {
  const { uc_id, action } = req.body;
  if (!uc_id || !action)
    return res.json({ success: false, message: "Missing parameters" });

  const uid = req.session.user.id;

  try {
    /* get club_id for this club head */
    const [[club]] = await db.promise().query(
      "SELECT id FROM clubs WHERE head_id = ?", [uid]
    );
    if (!club) return res.json({ success: false, message: "Club not found" });

    await db.promise().query(
      "UPDATE user_clubs SET status = ? WHERE user_id = ? AND club_id = ?",
      [action, uc_id, club.id]
    );
    res.json({ success: true });

  } catch (err) {
    console.error("Respond error:", err.message);
    res.json({ success: false, message: err.message });
  }
});

router.post("/members/remove", clubMiddleware, async (req, res) => {
  const { uc_id } = req.body;
  if (!uc_id) return res.json({ success: false, message: "Missing uc_id" });

  const uid = req.session.user.id;

  try {
    const [[club]] = await db.promise().query(
      "SELECT id FROM clubs WHERE head_id = ?", [uid]
    );
    if (!club) return res.json({ success: false, message: "Club not found" });

    await db.promise().query(
      "DELETE FROM user_clubs WHERE user_id = ? AND club_id = ?",
      [uc_id, club.id]
    );
    res.json({ success: true });

  } catch (err) {
    console.error("Remove member error:", err.message);
    res.json({ success: false, message: err.message });
  }
});

/* ═══════════════════════════════════════════
   EVENT MANAGEMENT
═══════════════════════════════════════════ */
router.post("/events/create", clubMiddleware, async (req, res) => {
  const { title, description, category, event_date, event_time, venue, seats } = req.body;
  const uid = req.session.user.id;

  if (!title || !event_date)
    return res.json({ success: false, message: "Title and date required" });

  try {
    const [[club]] = await db.promise().query(
      "SELECT name FROM clubs WHERE head_id = ?", [uid]
    );
    if (!club) return res.json({ success: false, message: "No club found" });

    await db.promise().query(
      `INSERT INTO events
         (title, description, category, event_date, event_time, venue, organizer, seats)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description||null, category||null, event_date,
       event_time||null, venue||null, club.name, seats||null]
    );
    res.json({ success: true });

  } catch (err) {
    console.error("Create event error:", err.message);
    res.json({ success: false, message: err.message });
  }
});

router.get("/events/list", clubMiddleware, async (req, res) => {
  const uid = req.session.user.id;

  try {
    const [[club]] = await db.promise().query(
      "SELECT name FROM clubs WHERE head_id = ?", [uid]
    );
    if (!club) return res.json([]);

    const [events] = await db.promise().query(
      `SELECT e.*, COUNT(er.id) AS registration_count
       FROM events e
       LEFT JOIN event_registrations er ON e.id = er.event_id
       WHERE e.organizer = ?
       GROUP BY e.id
       ORDER BY e.event_date DESC`,
      [club.name]
    );
    res.json(events);

  } catch (err) {
    console.error("Load events error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/events/registrations/:event_id", clubMiddleware, async (req, res) => {
  try {
    const [regs] = await db.promise().query(
      `SELECT u.username, u.email, u.prn, u.class_name
       FROM event_registrations er
       JOIN users u ON er.user_id = u.id
       WHERE er.event_id = ?`,
      [req.params.event_id]
    );
    res.json(regs);
  } catch (err) {
    console.error("Load registrations error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════
   ANNOUNCEMENTS
   notices schema: id, title, created_at,
                   club_id, created_by
   NO type column — removed from all queries
═══════════════════════════════════════════ */
router.post("/announcements/post", clubMiddleware, async (req, res) => {
  const { title } = req.body;
  const uid = req.session.user.id;

  if (!title || !String(title).trim())
    return res.json({ success: false, message: "Announcement text required" });

  try {
    /* Get club_id to store with the notice */
    const [[club]] = await db.promise().query(
      "SELECT id FROM clubs WHERE head_id = ?", [uid]
    );

    await db.promise().query(
      "INSERT INTO notices (title, created_by, club_id) VALUES (?, ?, ?)",
      [String(title).trim(), uid, club ? club.id : null]
    );
    res.json({ success: true });

  } catch (err) {
    console.error("Post announcement error:", err.message);
    res.json({ success: false, message: err.message });
  }
});

router.get("/announcements/list", clubMiddleware, async (req, res) => {
  const uid = req.session.user.id;

  try {
    /* Get notices for this club head — filter by created_by since no type */
    const [[club]] = await db.promise().query(
      "SELECT id FROM clubs WHERE head_id = ?", [uid]
    );

    let notices = [];
    if (club) {
      const [rows] = await db.promise().query(
        `SELECT id, title, created_at
         FROM notices
         WHERE club_id = ?
         ORDER BY created_at DESC`,
        [club.id]
      );
      notices = rows;
    }
    res.json(notices);

  } catch (err) {
    console.error("Load announcements error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;