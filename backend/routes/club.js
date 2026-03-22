"use strict";
/* ============================================================
   routes/club.js — Complete Club Management + Invitation System
============================================================ */

const express = require("express");
const router  = express.Router();
const db      = require("../db");
const path    = require("path");
const fs      = require("fs");

/* ── ENSURE ALL TABLES EXIST ON STARTUP ── */
async function ensureTables() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS club_invitations (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      club_id         INT NOT NULL,
      student_id INT NOT NULL,
      invited_by   INT NOT NULL,
      message         TEXT,
      status          ENUM('pending','accepted','declined','expired') DEFAULT 'pending',
      expires_at      DATETIME NOT NULL,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_inv_club   (club_id),
      INDEX idx_inv_user   (student_id),
      INDEX idx_inv_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS club_announcements (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      club_id    INT NOT NULL,
      posted_by  INT,
      title      TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX (club_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS club_meetings (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      club_id      INT NOT NULL,
      title        VARCHAR(255) NOT NULL,
      meeting_date DATE NOT NULL,
      description  TEXT,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX (club_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS club_attendance (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      meeting_id INT NOT NULL,
      user_id    INT NOT NULL,
      status     ENUM('present','late','absent') DEFAULT 'absent',
      UNIQUE KEY uq_meeting_user (meeting_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS club_treasury (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      club_id     INT NOT NULL,
      type        ENUM('income','expense') NOT NULL,
      description VARCHAR(500) NOT NULL,
      amount      DECIMAL(12,2) NOT NULL,
      date        DATE NOT NULL,
      category    VARCHAR(100),
      created_by  INT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX (club_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS club_tasks (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      club_id     INT NOT NULL,
      title       VARCHAR(255) NOT NULL,
      description TEXT,
      assigned_to INT,
      priority    ENUM('high','medium','low') DEFAULT 'medium',
      status      ENUM('pending','in_progress','done') DEFAULT 'pending',
      due_date    DATE,
      created_by  INT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX (club_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS club_polls (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      club_id    INT NOT NULL,
      question   VARCHAR(500) NOT NULL,
      is_active  TINYINT DEFAULT 1,
      ends_at    DATETIME,
      created_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX (club_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS club_poll_options (
      id      INT AUTO_INCREMENT PRIMARY KEY,
      poll_id INT NOT NULL,
      label   VARCHAR(255) NOT NULL,
      INDEX (poll_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS club_poll_votes (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      poll_id   INT NOT NULL,
      option_id INT NOT NULL,
      user_id   INT NOT NULL,
      UNIQUE KEY uq_poll_user (poll_id, user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

    `CREATE TABLE IF NOT EXISTS club_gallery (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      club_id     INT NOT NULL,
      title       VARCHAR(255) NOT NULL,
      event_name  VARCHAR(255),
      description TEXT,
      file_path   VARCHAR(500),
      file_type   VARCHAR(100),
      uploaded_by INT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX (club_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  ];

  for (const q of queries) {
    await db.promise().query(q).catch(err =>
      console.warn("[CLUB] Table setup warning:", err.message)
    );
  }

  console.log("✅ [CLUB] All tables verified");
}

ensureTables();

/* ── MIDDLEWARE ── */
function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: "Not authenticated" });
  next();
}
const requireClubAccess = requireAuth;

/* ── SAFE NOTIFICATION INSERT ── */
async function sendNotification(userId, message) {
  const attempts = [
    "INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (?, ?, 0, NOW())",
    "INSERT INTO notifications (user_id, message, created_at) VALUES (?, ?, NOW())",
    "INSERT INTO notifications (user_id, message) VALUES (?, ?)"
  ];
  for (const sql of attempts) {
    try {
      await db.promise().query(sql, [userId, message]);
      return;
    } catch (e) { /* try next */ }
  }
  console.warn("[CLUB] Could not insert notification for user", userId);
}

/* ── HELPER: get club ID for logged-in user ── */
async function getUserClubId(userId, userRole) {
  if (userRole === "admin") return null;

  // Try approved membership first
  const [[row]] = await db.promise().query(
    `SELECT club_id FROM user_clubs
     WHERE user_id = ? AND status = 'approved'
     LIMIT 1`,
    [userId]
  );
  if (row?.club_id) return row.club_id;

  // For club_head: also try any membership row (approved or not)
  if (userRole === "club_head") {
    const [[row2]] = await db.promise().query(
      `SELECT club_id FROM user_clubs WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    if (row2?.club_id) return row2.club_id;
  }

  return null;
}

/* ─────────────────────────────────────────────────────────
   DASHBOARD DATA
───────────────────────────────────────────────────────── */
router.get("/data", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json({ memberCount:0, pendingCount:0, eventCount:0, announcementCount:0, name:"Club" });

    const [[club]]      = await db.promise().query("SELECT name FROM clubs WHERE id=?", [clubId]);
    const [[members]]   = await db.promise().query("SELECT COUNT(*) AS c FROM user_clubs WHERE club_id=? AND status='approved'", [clubId]);
    const [[pending]]   = await db.promise().query("SELECT COUNT(*) AS c FROM user_clubs WHERE club_id=? AND status='pending'", [clubId]);
    const [[events]]    = await db.promise().query("SELECT COUNT(*) AS c FROM events WHERE club_id=?", [clubId]).catch(()=>[[{c:0}]]);
    const [[announces]] = await db.promise().query("SELECT COUNT(*) AS c FROM club_announcements WHERE club_id=?", [clubId]);

    res.json({
      name: club?.name || "Club",
      memberCount: members.c, pendingCount: pending.c,
      eventCount: events.c,   announcementCount: announces.c
    });
  } catch (e) {
    console.error("[CLUB] /data:", e.message);
    res.status(500).json({ error: "Server error" });
  }
});

/* ─────────────────────────────────────────────────────────
   MY IDENTITY
───────────────────────────────────────────────────────── */
router.get("/my-identity", requireClubAccess, async (req, res) => {
  try {
    const userId   = req.session.userId;
    const userRole = req.session.role;

    const [[user]] = await db.promise().query(
      "SELECT username FROM users WHERE id=?", [userId]
    );

    const [rows] = await db.promise().query(
      `SELECT uc.user_id AS uc_id, uc.club_id, uc.position_name, c.name AS club_name
       FROM user_clubs uc JOIN clubs c ON c.id = uc.club_id
       WHERE uc.user_id=? AND uc.status='approved'
       LIMIT 1`,
      [userId]
    );

    const m = rows[0];
    res.json({
      user_id:   userId,
      username:  user?.username || "User",
      user_role: userRole,
      club_id:   m?.club_id    || null,
      club_name: m?.club_name  || null,
      uc_id:     m?.uc_id      || null,
      position:  m?.position_name || (userRole === "club_head" ? "President" : "Member")
    });
  } catch (e) {
    console.error("[CLUB] /my-identity ERROR:", e.message, e.stack);
    res.status(500).json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────────
   ANALYTICS
───────────────────────────────────────────────────────── */
router.get("/analytics", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json({ memberCount:0, pendingCount:0, upcomingEvents:0, recentMembers:[] });

    const [[mc]] = await db.promise().query("SELECT COUNT(*) AS c FROM user_clubs WHERE club_id=? AND status='approved'", [clubId]);
    const [[pc]] = await db.promise().query("SELECT COUNT(*) AS c FROM user_clubs WHERE club_id=? AND status='pending'", [clubId]);
    const [[uc]] = await db.promise().query("SELECT COUNT(*) AS c FROM events WHERE club_id=? AND event_date>=CURDATE()", [clubId]).catch(()=>[[{c:0}]]);
    const [rm]   = await db.promise().query(
      `SELECT u.username, uc.position_name, u.class_name
       FROM user_clubs uc JOIN users u ON u.id=uc.user_id
       WHERE uc.club_id=? AND uc.status='approved' ORDER BY uc.created_at DESC LIMIT 5`,
      [clubId]
    );
    res.json({ memberCount: mc.c, pendingCount: pc.c, upcomingEvents: uc.c, recentMembers: rm });
  } catch (e) {
    console.error("[CLUB] /analytics:", e.message);
    res.json({ memberCount:0, pendingCount:0, upcomingEvents:0, recentMembers:[] });
  }
});

/* ─────────────────────────────────────────────────────────
   MEMBERS
───────────────────────────────────────────────────────── */
router.get("/members/list", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json([]);
    const [rows] = await db.promise().query(
      `SELECT uc.user_id AS uc_id, u.id AS user_id, u.username, u.email, u.prn, u.class_name, uc.position_name
       FROM user_clubs uc JOIN users u ON u.id=uc.user_id
       WHERE uc.club_id=? AND uc.status='approved' ORDER BY u.username`,
      [clubId]
    );
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.get("/members/requests", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json([]);
    const [rows] = await db.promise().query(
      `SELECT uc.user_id AS uc_id, u.username, u.email, u.prn, u.class_name
       FROM user_clubs uc JOIN users u ON u.id=uc.user_id
       WHERE uc.club_id=? AND uc.status='pending' ORDER BY uc.created_at DESC`,
      [clubId]
    );
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.post("/members/respond", requireClubAccess, async (req, res) => {
  try {
    const { uc_id, action } = req.body;
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (action === "rejected") {
      await db.promise().query("DELETE FROM user_clubs WHERE user_id=? AND club_id=?", [uc_id, clubId]);
    } else {
      await db.promise().query("UPDATE user_clubs SET status='approved' WHERE user_id=? AND club_id=?", [uc_id, clubId]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

router.post("/members/remove", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    await db.promise().query("DELETE FROM user_clubs WHERE user_id=? AND club_id=?", [req.body.uc_id, clubId]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

router.post("/members/change-position", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    await db.promise().query(
      "UPDATE user_clubs SET position_name=? WHERE user_id=? AND club_id=?",
      [req.body.position, req.body.uc_id, clubId]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

/* ─────────────────────────────────────────────────────────
   SEARCH STUDENTS
───────────────────────────────────────────────────────── */
router.get("/members/search", requireClubAccess, async (req, res) => {
  try {
    const userId = req.session.userId;
    const clubId = await getUserClubId(userId, req.session.role);
    if (!clubId) return res.json([]);

    const q = `%${(req.query.q || "").trim()}%`;
    const [rows] = await db.promise().query(
      `SELECT u.id, u.username, u.email, u.prn, u.class_name,
              uc.status AS membership_status,
              NULL AS pending_invite
       FROM users u
       LEFT JOIN user_clubs uc ON uc.user_id=u.id AND uc.club_id=?
       WHERE u.role='student'
         AND (u.username LIKE ? OR u.email LIKE ? OR u.prn LIKE ?)
       LIMIT 20`,
      [clubId, q, q, q]
    );
    res.json(rows);
  } catch (e) {
    console.error("[CLUB] /members/search:", e.message);
    res.status(500).json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────────
   INVITATIONS — SEND
───────────────────────────────────────────────────────── */
router.post("/invitations/send", requireClubAccess, async (req, res) => {
  try {
    const inviterId = req.session.userId;
    const { student_id, message } = req.body;

    if (!student_id) return res.json({ success: false, message: "No student specified" });

    const clubId = await getUserClubId(inviterId, req.session.role);
    if (!clubId) return res.json({ success: false, message: "You are not assigned to any club" });

    const [[existingMember]] = await db.promise().query(
      "SELECT user_id, status FROM user_clubs WHERE user_id=? AND club_id=?",
      [student_id, clubId]
    );
    if (existingMember?.status === "approved")
      return res.json({ success: false, message: "Student is already a member" });

    const [[existingInvite]] = await db.promise().query(
      `SELECT id FROM club_invitations
       WHERE student_id=? AND club_id=? AND status='pending' AND expires_at > NOW()`,
      [student_id, clubId]
    );
    if (existingInvite)
      return res.json({ success: false, message: "A pending invitation already exists for this student" });

    const [[club]]    = await db.promise().query("SELECT name FROM clubs WHERE id=?", [clubId]);
    const [[inviter]] = await db.promise().query("SELECT username FROM users WHERE id=?", [inviterId]);
    const [[student]] = await db.promise().query("SELECT id, username FROM users WHERE id=? AND role='student'", [student_id]);
    if (!student) return res.json({ success: false, message: "Student not found" });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                        .toISOString().slice(0, 19).replace("T", " ");

    const [result] = await db.promise().query(
      `INSERT INTO club_invitations (club_id, student_id, invited_by, message, status, expires_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [clubId, student_id, inviterId, message || null, expiresAt]
    );

    const notifMsg = `📨 Club Invitation: ${inviter?.username || "A club head"} invited you to join "${club?.name || "a club"}". Open Notifications to respond!`;
    await sendNotification(student_id, notifMsg);

    res.json({ success: true, invitation_id: result.insertId });
  } catch (e) {
    console.error("[CLUB] /invitations/send ERROR:", e.message);
    res.status(500).json({ success: false, message: "Server error: " + e.message });
  }
});

/* ─────────────────────────────────────────────────────────
   INVITATIONS — SENT LIST
───────────────────────────────────────────────────────── */
router.get("/invitations/sent", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json([]);

    await db.promise().query(
      "UPDATE club_invitations SET status='expired' WHERE club_id=? AND status='pending' AND expires_at<=NOW()",
      [clubId]
    ).catch(() => {});

    const [rows] = await db.promise().query(
      `SELECT ci.id, ci.status, ci.expires_at, ci.updated_at, ci.created_at,
              u.username, u.prn, u.class_name
       FROM club_invitations ci
       JOIN users u ON u.id=ci.student_id
       WHERE ci.club_id=?
       ORDER BY ci.created_at DESC LIMIT 50`,
      [clubId]
    );
    res.json(rows);
  } catch (e) {
    console.error("[CLUB] /invitations/sent:", e.message);
    res.json([]);
  }
});

/* ─────────────────────────────────────────────────────────
   INVITATIONS — MINE (student)
───────────────────────────────────────────────────────── */
router.get("/invitations/mine", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    await db.promise().query(
      "UPDATE club_invitations SET status='expired' WHERE student_id=? AND status='pending' AND expires_at<=NOW()",
      [userId]
    ).catch(() => {});

    const [rows] = await db.promise().query(
      `SELECT ci.id, ci.status, ci.message, ci.expires_at, ci.created_at,
              c.name AS club_name, u.username AS invited_by_name
       FROM club_invitations ci
       JOIN clubs c ON c.id=ci.club_id
       JOIN users u ON u.id=ci.invited_by
       WHERE ci.student_id=?
       ORDER BY FIELD(ci.status,'pending','accepted','declined','expired'), ci.created_at DESC`,
      [userId]
    );
    res.json(rows);
  } catch (e) {
    console.error("[CLUB] /invitations/mine:", e.message);
    res.json([]);
  }
});

/* ─────────────────────────────────────────────────────────
   INVITATIONS — RESPOND
───────────────────────────────────────────────────────── */
router.post("/invitations/respond", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { invitation_id, action } = req.body;

    if (!["accepted","declined"].includes(action))
      return res.json({ success: false, message: "Invalid action" });

    const [[inv]] = await db.promise().query(
      `SELECT ci.id, ci.club_id, ci.invited_by, ci.status, ci.expires_at, c.name AS club_name
       FROM club_invitations ci JOIN clubs c ON c.id=ci.club_id
       WHERE ci.id=? AND ci.student_id=?`,
      [invitation_id, userId]
    );

    if (!inv)                     return res.json({ success: false, message: "Invitation not found" });
    if (inv.status !== "pending") return res.json({ success: false, message: `Invitation already ${inv.status}` });
    if (new Date(inv.expires_at) < new Date()) {
      await db.promise().query("UPDATE club_invitations SET status='expired' WHERE id=?", [invitation_id]);
      return res.json({ success: false, message: "This invitation has expired" });
    }

    await db.promise().query("UPDATE club_invitations SET status=? WHERE id=?", [action, invitation_id]);

    if (action === "accepted") {
      const [[existing]] = await db.promise().query(
        "SELECT user_id FROM user_clubs WHERE user_id=? AND club_id=?", [userId, inv.club_id]
      );
      if (existing) {
        await db.promise().query(
          "UPDATE user_clubs SET status='approved', position_name='Member' WHERE user_id=? AND club_id=?",
          [userId, inv.club_id]
        );
      } else {
        await db.promise().query(
          "INSERT INTO user_clubs (user_id, club_id, status, position_name) VALUES (?,?,'approved','Member')",
          [userId, inv.club_id]
        );
      }
      const [[student]] = await db.promise().query("SELECT username FROM users WHERE id=?", [userId]);
      await sendNotification(
        inv.invited_by,
        `✅ ${student?.username || "A student"} accepted your invitation to join "${inv.club_name}"!`
      );
    }

    res.json({ success: true, action, club_name: inv.club_name });
  } catch (e) {
    console.error("[CLUB] /invitations/respond ERROR:", e.message);
    res.status(500).json({ success: false, message: "Server error: " + e.message });
  }
});

/* ─────────────────────────────────────────────────────────
   INVITATIONS — CANCEL
───────────────────────────────────────────────────────── */
router.post("/invitations/cancel", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    await db.promise().query(
      "DELETE FROM club_invitations WHERE id=? AND club_id=? AND status='pending'",
      [req.body.invitation_id, clubId]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

/* ─────────────────────────────────────────────────────────
   STUDENT CLUBS WIDGET
───────────────────────────────────────────────────────── */
router.get("/student-clubs", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const [memberships] = await db.promise().query(
      `SELECT c.name AS club_name, uc.position_name AS position
       FROM user_clubs uc JOIN clubs c ON c.id=uc.club_id
       WHERE uc.user_id=? AND uc.status='approved'`,
      [userId]
    );
    const [[inv]] = await db.promise().query(
      "SELECT COUNT(*) AS c FROM club_invitations WHERE student_id=? AND status='pending' AND expires_at>NOW()",
      [userId]
    ).catch(()=>[[{c:0}]]);
    res.json({ memberships, pendingInvites: inv?.c || 0 });
  } catch (e) {
    res.json({ memberships: [], pendingInvites: 0 });
  }
});

/* ─────────────────────────────────────────────────────────
   ANNOUNCEMENTS
───────────────────────────────────────────────────────── */
router.post("/announcements/post", requireClubAccess, async (req, res) => {
  try {
    const userId = req.session.userId;
    const clubId = await getUserClubId(userId, req.session.role);
    if (!clubId) return res.json({ success: false, message: "Not assigned to a club" });

    const { title } = req.body;
    if (!title?.trim()) return res.json({ success: false, message: "Content required" });

    await db.promise().query(
      "INSERT INTO club_announcements (club_id, posted_by, title, created_at) VALUES (?,?,?,NOW())",
      [clubId, userId, title.trim()]
    );

    const [[club]]  = await db.promise().query("SELECT name FROM clubs WHERE id=?", [clubId]);
    const [members] = await db.promise().query(
      "SELECT user_id FROM user_clubs WHERE club_id=? AND status='approved' AND user_id!=?",
      [clubId, userId]
    );
    for (const m of members)
      await sendNotification(m.user_id, `📢 New announcement from ${club?.name || "your club"}: "${title.trim().slice(0,80)}"`);

    res.json({ success: true });
  } catch (e) {
    console.error("[CLUB] /announcements/post:", e.message);
    res.status(500).json({ success: false });
  }
});

router.get("/announcements/list", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json([]);
    const [rows] = await db.promise().query(
      `SELECT ca.id, ca.title, ca.created_at, u.username AS posted_by
       FROM club_announcements ca LEFT JOIN users u ON u.id=ca.posted_by
       WHERE ca.club_id=? ORDER BY ca.created_at DESC LIMIT 30`,
      [clubId]
    );
    res.json(rows);
  } catch (e) { res.json([]); }
});

/* ─────────────────────────────────────────────────────────
   EVENTS
───────────────────────────────────────────────────────── */
router.get("/events/list", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json([]);
    const [rows] = await db.promise().query(
      `SELECT e.*, (SELECT COUNT(*) FROM event_registrations WHERE event_id=e.id) AS reg_count
       FROM events e WHERE e.club_id=? ORDER BY e.event_date DESC`,
      [clubId]
    ).catch(()=>[[]]);
    res.json(Array.isArray(rows) ? rows : []);
  } catch (e) { res.json([]); }
});

router.post("/events/create", requireClubAccess, async (req, res) => {
  try {
    const userId = req.session.userId;
    const clubId = await getUserClubId(userId, req.session.role);
    if (!clubId) return res.json({ success: false });

    const { title, description, category, event_date, event_time, venue, seats } = req.body;
    if (!title || !event_date) return res.json({ success: false, message: "Title and date required" });

    const [[club]] = await db.promise().query("SELECT name FROM clubs WHERE id=?", [clubId]);
    await db.promise().query(
      `INSERT INTO events (title, description, category, event_date, event_time, venue, club_id, organizer, seats, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,NOW())`,
      [title, description||null, category||"General", event_date, event_time||null, venue||null, clubId, club?.name||"Club", seats||null]
    );
    res.json({ success: true });
  } catch (e) {
    console.error("[CLUB] /events/create:", e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

/* ─────────────────────────────────────────────────────────
   ATTENDANCE (meetings)
───────────────────────────────────────────────────────── */
router.get("/attendance/meetings", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json([]);
    const [rows] = await db.promise().query(
      `SELECT cm.*,
              COALESCE(SUM(ca.status='present'),0) AS present,
              COALESCE(SUM(ca.status='late'),   0) AS late,
              COALESCE(SUM(ca.status='absent'), 0) AS absent,
              COUNT(ca.id)                          AS total
       FROM club_meetings cm
       LEFT JOIN club_attendance ca ON ca.meeting_id=cm.id
       WHERE cm.club_id=?
       GROUP BY cm.id ORDER BY cm.meeting_date DESC`,
      [clubId]
    );
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.post("/attendance/meeting/create", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json({ success: false });
    const { title, meeting_date, description } = req.body;
    const [r] = await db.promise().query(
      "INSERT INTO club_meetings (club_id, title, meeting_date, description, created_by) VALUES (?,?,?,?,?)",
      [clubId, title, meeting_date, description||null, req.session.userId]
    );
    res.json({ success: true, meeting_id: r.insertId });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get("/attendance/meeting/:id", requireClubAccess, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT user_id, status FROM club_attendance WHERE meeting_id=?", [req.params.id]
    );
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.post("/attendance/meeting/mark", requireClubAccess, async (req, res) => {
  try {
    const { meeting_id, records } = req.body;
    for (const r of (records || [])) {
      await db.promise().query(
        `INSERT INTO club_attendance (meeting_id, user_id, status) VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE status=VALUES(status)`,
        [meeting_id, r.user_id, r.status]
      );
    }
    const present = (records||[]).filter(r => r.status==="present").length;
    res.json({ success: true, present, total: (records||[]).length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get("/attendance/member-report", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json([]);
    const [rows] = await db.promise().query(
      `SELECT u.username, u.email, u.class_name,
              COALESCE(SUM(ca.status='present'),0) AS present,
              COALESCE(SUM(ca.status='late'),   0) AS late,
              COALESCE(SUM(ca.status='absent'), 0) AS absent,
              COUNT(ca.id) AS total,
              CASE WHEN COUNT(ca.id)=0 THEN 0
                   ELSE ROUND((SUM(ca.status='present')+SUM(ca.status='late'))/COUNT(ca.id)*100)
              END AS pct
       FROM user_clubs uc JOIN users u ON u.id=uc.user_id
       LEFT JOIN club_meetings cm ON cm.club_id=uc.club_id
       LEFT JOIN club_attendance ca ON ca.meeting_id=cm.id AND ca.user_id=uc.user_id
       WHERE uc.club_id=? AND uc.status='approved'
       GROUP BY u.id, u.username, u.email, u.class_name`,
      [clubId]
    );
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.post("/attendance/meeting/delete", requireClubAccess, async (req, res) => {
  try {
    const id = req.body.meeting_id;
    await db.promise().query("DELETE FROM club_attendance WHERE meeting_id=?", [id]);
    await db.promise().query("DELETE FROM club_meetings WHERE id=?", [id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

/* ─────────────────────────────────────────────────────────
   TREASURY
───────────────────────────────────────────────────────── */
router.get("/treasury/list", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json([]);
    const [rows] = await db.promise().query(
      "SELECT * FROM club_treasury WHERE club_id=? ORDER BY date DESC, id DESC", [clubId]
    );
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.post("/treasury/add", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json({ success: false });
    const { type, description, amount, date, category } = req.body;
    await db.promise().query(
      "INSERT INTO club_treasury (club_id, type, description, amount, date, category, created_by) VALUES (?,?,?,?,?,?,?)",
      [clubId, type, description, amount, date, category||null, req.session.userId]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/treasury/delete", requireClubAccess, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM club_treasury WHERE id=?", [req.body.tx_id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

/* ─────────────────────────────────────────────────────────
   TASKS
───────────────────────────────────────────────────────── */
router.get("/tasks/list", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json([]);
    const [rows] = await db.promise().query(
      "SELECT * FROM club_tasks WHERE club_id=? ORDER BY created_at DESC", [clubId]
    );
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.post("/tasks/create", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json({ success: false });
    const { title, description, assigned_to, priority, due_date } = req.body;
    await db.promise().query(
      "INSERT INTO club_tasks (club_id, title, description, assigned_to, priority, due_date, created_by) VALUES (?,?,?,?,?,?,?)",
      [clubId, title, description||null, assigned_to||null, priority||"medium", due_date||null, req.session.userId]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/tasks/status", requireClubAccess, async (req, res) => {
  try {
    await db.promise().query("UPDATE club_tasks SET status=? WHERE id=?", [req.body.status, req.body.task_id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

router.post("/tasks/delete", requireClubAccess, async (req, res) => {
  try {
    await db.promise().query("DELETE FROM club_tasks WHERE id=?", [req.body.task_id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

/* ─────────────────────────────────────────────────────────
   DEBUG
───────────────────────────────────────────────────────── */
router.get("/debug", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const role   = req.session.role;
    const [rows] = await db.promise().query("SELECT * FROM user_clubs WHERE user_id = ?", [userId]);
    const clubId = await getUserClubId(userId, role);
    res.json({ userId, role, clubId, rows });
  } catch(e) {
    res.json({ error: e.message });
  }
});

/* ─────────────────────────────────────────────────────────
   POLLS  ← EACH ROUTE DEFINED EXACTLY ONCE
───────────────────────────────────────────────────────── */
router.get("/polls/list", requireClubAccess, async (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  try {
    const userId = req.session.userId;
    const role   = req.session.role;
    const clubId = await getUserClubId(userId, role);

    console.log("[POLLS LIST] userId:", userId, "role:", role, "clubId:", clubId);

    if (!clubId) return res.json([]);

    const [polls] = await db.promise().query(
      "SELECT * FROM club_polls WHERE club_id=? ORDER BY created_at DESC",
      [clubId]
    );

    console.log("[POLLS LIST] found", polls.length, "polls");

    const result = [];
    for (const p of polls) {
      const [opts] = await db.promise().query(
        `SELECT po.id, po.label, COUNT(pv.option_id) AS vote_count
         FROM club_poll_options po
         LEFT JOIN club_poll_votes pv ON pv.option_id=po.id
         WHERE po.poll_id=?
         GROUP BY po.id, po.label
         ORDER BY po.id`,
        [p.id]
      );
      const [[myVote]] = await db.promise().query(
        "SELECT option_id FROM club_poll_votes WHERE poll_id=? AND user_id=?",
        [p.id, userId]
      ).catch(() => [[null]]);

      result.push({ ...p, options: opts, user_voted_option: myVote?.option_id || null });
    }
    res.json(result);
  } catch (e) {
    console.error("[POLLS LIST] ERROR:", e.message, e.stack);
    res.status(500).json([]);
  }
});

router.post("/polls/create", requireClubAccess, async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const userId = req.session.userId;
    const clubId = await getUserClubId(userId, req.session.role);

    console.log("[POLLS CREATE] userId:", userId, "clubId:", clubId);

    if (!clubId) return res.json({ success: false, message: "Not assigned to any club" });

    const { question, options, ends_at } = req.body;
    if (!question?.trim()) return res.json({ success: false, message: "Question required" });
    if (!options?.length || options.length < 2)
      return res.json({ success: false, message: "At least 2 options required" });

    const [r] = await db.promise().query(
      "INSERT INTO club_polls (club_id, question, ends_at, created_by) VALUES (?,?,?,?)",
      [clubId, question.trim(), ends_at || null, userId]
    );

    for (const opt of options) {
      if (opt?.trim()) {
        await db.promise().query(
          "INSERT INTO club_poll_options (poll_id, label) VALUES (?,?)",
          [r.insertId, opt.trim()]
        );
      }
    }

    console.log("[POLLS CREATE] ✅ created poll", r.insertId, "for club", clubId);
    res.json({ success: true, poll_id: r.insertId });
  } catch (e) {
    console.error("[POLLS CREATE] ERROR:", e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/polls/vote", requireClubAccess, async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const userId = req.session.userId;
    const { poll_id, option_id } = req.body;

    const [[poll]] = await db.promise().query(
      "SELECT is_active FROM club_polls WHERE id=?", [poll_id]
    );
    if (!poll)           return res.json({ success: false, message: "Poll not found" });
    if (!poll.is_active) return res.json({ success: false, message: "Poll is closed" });

    const [[existing]] = await db.promise().query(
      "SELECT poll_id FROM club_poll_votes WHERE poll_id=? AND user_id=?", [poll_id, userId]
    );
    if (existing) return res.json({ success: false, message: "You have already voted" });

    await db.promise().query(
      "INSERT INTO club_poll_votes (poll_id, option_id, user_id) VALUES (?,?,?)",
      [poll_id, option_id, userId]
    );
    res.json({ success: true });
  } catch (e) {
    console.error("[POLLS VOTE] ERROR:", e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/polls/close", requireClubAccess, async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    await db.promise().query("UPDATE club_polls SET is_active=0 WHERE id=?", [req.body.poll_id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

router.post("/polls/delete", requireClubAccess, async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const id = req.body.poll_id;
    await db.promise().query("DELETE FROM club_poll_votes   WHERE poll_id=?", [id]);
    await db.promise().query("DELETE FROM club_poll_options WHERE poll_id=?", [id]);
    await db.promise().query("DELETE FROM club_polls        WHERE id=?",      [id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

/* ─────────────────────────────────────────────────────────
   GALLERY
───────────────────────────────────────────────────────── */
const multer = require("multer");

const galleryUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, "../public/uploads/gallery");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${safe}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get("/gallery/list", requireClubAccess, async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId) return res.json([]);
    const [rows] = await db.promise().query(
      "SELECT * FROM club_gallery WHERE club_id=? ORDER BY created_at DESC", [clubId]
    );
    res.json(rows);
  } catch (e) { res.json([]); }
});

router.post("/gallery/upload", requireClubAccess, galleryUpload.single("photo"), async (req, res) => {
  try {
    const clubId = await getUserClubId(req.session.userId, req.session.role);
    if (!clubId || !req.file) return res.json({ success: false, message: "No club or file" });
    await db.promise().query(
      "INSERT INTO club_gallery (club_id, title, event_name, description, file_path, file_type, uploaded_by) VALUES (?,?,?,?,?,?,?)",
      [clubId, req.body.title, req.body.event_name||null, req.body.description||null,
       req.file.path, req.file.mimetype, req.session.userId]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/gallery/delete", requireClubAccess, async (req, res) => {
  try {
    const [[p]] = await db.promise().query("SELECT file_path FROM club_gallery WHERE id=?", [req.body.photo_id]);
    if (p?.file_path) fs.unlink(p.file_path, () => {});
    await db.promise().query("DELETE FROM club_gallery WHERE id=?", [req.body.photo_id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false }); }
});

/* ─────────────────────────────────────────────────────────
   PAGE ROUTES
───────────────────────────────────────────────────────── */
const publicDir = path.join(__dirname, "../public");

function authPage(req, res, next) {
  if (!req.session?.userId) return res.redirect("/login.html");
  const allowedRoles = ["club_head", "admin", "student", "faculty", "alumni"];
  if (!allowedRoles.includes(req.session.role)) return res.redirect("/login.html");
  next();
}

router.get("/student/my-club-page", authPage, (req, res) =>
  res.sendFile(path.join(publicDir, "dashboards/student/student-club.html"))
);

/* ─────────────────────────────────────────────────────────
   STUDENT — MY CLUB API
───────────────────────────────────────────────────────── */
router.get("/student/my-club", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const [[membership]] = await db.promise().query(
      `SELECT uc.club_id, uc.position_name, uc.status, c.name AS club_name
       FROM user_clubs uc JOIN clubs c ON c.id = uc.club_id
       WHERE uc.user_id = ? AND uc.status = 'approved'
       LIMIT 1`,
      [userId]
    );

    const [[anyMembership]] = await db.promise().query(
      "SELECT status, club_id FROM user_clubs WHERE user_id=? LIMIT 1", [userId]
    );
    if (!anyMembership) return res.json({ joined: false });
    if (anyMembership.status === 'pending') {
      const [[pc]] = await db.promise().query("SELECT name FROM clubs WHERE id=?", [anyMembership.club_id]);
      return res.json({ joined: false, pending: true, club_name: pc?.name });
    }
    if (!membership) return res.json({ joined: false });

    const clubId = membership.club_id;

    const [announcements] = await db.promise().query(
      `SELECT ca.title, ca.created_at, u.username AS posted_by
       FROM club_announcements ca
       LEFT JOIN users u ON u.id = ca.posted_by
       WHERE ca.club_id = ?
       ORDER BY ca.created_at DESC LIMIT 10`,
      [clubId]
    );

    const [tasks] = await db.promise().query(
      `SELECT id, title, description, priority, status, due_date
       FROM club_tasks
       WHERE club_id = ? AND assigned_to = ?
       ORDER BY created_at DESC`,
      [clubId, userId]
    );

    const [attendance] = await db.promise().query(
      `SELECT cm.title, cm.meeting_date,
              COALESCE(ca.status, 'absent') AS status
       FROM club_meetings cm
       LEFT JOIN club_attendance ca ON ca.meeting_id = cm.id AND ca.user_id = ?
       WHERE cm.club_id = ?
       ORDER BY cm.meeting_date DESC LIMIT 20`,
      [userId, clubId]
    );

    const [members] = await db.promise().query(
      `SELECT u.username, uc.position_name
       FROM user_clubs uc JOIN users u ON u.id = uc.user_id
       WHERE uc.club_id = ? AND uc.status = 'approved'
       ORDER BY u.username`,
      [clubId]
    );

    res.json({
      joined: true,
      club_name: membership.club_name,
      position: membership.position_name,
      announcements,
      tasks,
      attendance,
      members
    });
  } catch (e) {
    console.error("[CLUB] /student/my-club:", e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get("/student/all-clubs", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const [clubs] = await db.promise().query(
      `SELECT c.id, c.name,
              (SELECT COUNT(*) FROM user_clubs uc WHERE uc.club_id = c.id AND uc.status = 'approved') AS member_count,
              (SELECT uc2.status FROM user_clubs uc2 WHERE uc2.user_id = ? AND uc2.club_id = c.id LIMIT 1) AS my_status
       FROM clubs c ORDER BY c.name`,
      [userId]
    );
    res.json(clubs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/student/join-request", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { club_id } = req.body;

    const [[existing]] = await db.promise().query(
      "SELECT status FROM user_clubs WHERE user_id=? AND club_id=?", [userId, club_id]
    );
    if (existing) return res.json({ success: false, message: `Already ${existing.status}` });

    await db.promise().query(
      "INSERT INTO user_clubs (user_id, club_id, status, position_name) VALUES (?,?,'pending','Member')",
      [userId, club_id]
    );

    const [[club]]    = await db.promise().query("SELECT name FROM clubs WHERE id=?", [club_id]);
    const [[head]]    = await db.promise().query(
      `SELECT u.id FROM users u WHERE u.role='club_head'
       AND EXISTS (SELECT 1 FROM user_clubs uc WHERE uc.user_id=u.id AND uc.club_id=?)
       LIMIT 1`,
      [club_id]
    );
    if (head) {
      const [[student]] = await db.promise().query("SELECT username FROM users WHERE id=?", [userId]);
      await sendNotification(head.id, `📋 ${student?.username} requested to join "${club?.name}"`);
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post("/student/leave-club", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    await db.promise().query(
      "DELETE FROM user_clubs WHERE user_id=? AND position_name='Member'", [userId]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

/* ─────────────────────────────────────────────────────────
   MAIN CLUB PAGE ROUTE  ← role-based redirect
───────────────────────────────────────────────────────── */
router.get("/", authPage, (req, res) => {
  const role = req.session.role;
  if (role === "club_head" || role === "admin") {
    return res.sendFile(path.join(publicDir, "dashboards/club/club-dashboard.html"));
  }
  return res.redirect("/club/student/my-club-page");
});

router.get("/members",       authPage, (req, res) => res.sendFile(path.join(publicDir, "dashboards/club/club-members.html")));
router.get("/events",        authPage, (req, res) => res.sendFile(path.join(publicDir, "dashboards/club/club-events.html")));
router.get("/announcements", authPage, (req, res) => res.sendFile(path.join(publicDir, "dashboards/club/club-announcements.html")));
router.get("/attendance",    authPage, (req, res) => res.sendFile(path.join(publicDir, "dashboards/club/club-attendance.html")));
router.get("/treasury",      authPage, (req, res) => res.sendFile(path.join(publicDir, "dashboards/club/club-treasury.html")));
router.get("/tasks",         authPage, (req, res) => res.sendFile(path.join(publicDir, "dashboards/club/club-tasks.html")));
router.get("/polls",         authPage, (req, res) => res.sendFile(path.join(publicDir, "dashboards/club/club-polls.html")));
router.get("/gallery",       authPage, (req, res) => res.sendFile(path.join(publicDir, "dashboards/club/club-gallery.html")));
router.get("/invitations",   authPage, (req, res) => res.sendFile(path.join(publicDir, "dashboards/club/club-invitations.html")));

module.exports = router;