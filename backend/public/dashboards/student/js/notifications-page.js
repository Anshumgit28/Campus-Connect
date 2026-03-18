const express = require("express");
const router  = require("express").Router();
const db      = require("../db");
const auth    = require("../middleware/authMiddleware");

/* ── GET MY NOTIFICATIONS ── */
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      `SELECT id, message, created_at,
              COALESCE(is_read, 0) AS is_read
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 20`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (err) {
    /* If user_id column doesn't exist yet, return empty rather than crash */
    console.error("Notifications fetch error:", err.message);
    res.json([]);
  }
});

/* ── UNREAD COUNT ── */
router.get("/count", auth, async (req, res) => {
  try {
    const [[row]] = await db.promise().query(
      `SELECT COUNT(*) AS c FROM notifications
       WHERE user_id = ? AND COALESCE(is_read, 0) = 0`,
      [req.session.user.id]
    );
    res.json({ count: row.c });
  } catch (err) {
    console.error("Notification count error:", err.message);
    res.json({ count: 0 });
  }
});

/* ── MARK SINGLE READ ── */
router.post("/read/:id", auth, async (req, res) => {
  try {
    await db.promise().query(
      "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
      [req.params.id, req.session.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Mark read error:", err.message);
    res.json({ success: false });
  }
});

/* ── MARK ALL READ ── */
router.post("/read-all", auth, async (req, res) => {
  try {
    await db.promise().query(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
      [req.session.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Mark all read error:", err.message);
    res.json({ success: false });
  }
});

module.exports = router;