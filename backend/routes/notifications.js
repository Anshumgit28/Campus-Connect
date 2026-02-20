const express = require("express");
const router = express.Router();
const db = require("../db");
const auth = require("../middleware/authMiddleware");

/* ── GET MY NOTIFICATIONS ── */
router.get("/", auth, async (req, res) => {
  try {
    const [rows] = await db.promise().query(
      "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20",
      [req.session.user.id]
    );
    res.json(rows);
  } catch (e) { console.error(e); res.json([]); }
});

/* ── UNREAD COUNT ── */
router.get("/count", auth, async (req, res) => {
  try {
    const [[row]] = await db.promise().query(
      "SELECT COUNT(*) c FROM notifications WHERE user_id=? AND is_read=0",
      [req.session.user.id]
    );
    res.json({ count: row.c });
  } catch (e) { console.error(e); res.json({ count: 0 }); }
});

/* ── MARK SINGLE AS READ ── */
router.post("/read/:id", auth, async (req, res) => {
  try {
    await db.promise().query(
      "UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?",
      [req.params.id, req.session.user.id]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.json({ success: false }); }
});

/* ── MARK ALL READ ── */
router.post("/read-all", auth, async (req, res) => {
  try {
    await db.promise().query(
      "UPDATE notifications SET is_read=1 WHERE user_id=?",
      [req.session.user.id]
    );
    res.json({ success: true });
  } catch (e) { console.error(e); res.json({ success: false }); }
});

module.exports = router;