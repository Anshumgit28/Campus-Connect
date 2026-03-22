/* ============================================================
   clubMiddleware.js — FIXED
   
   OLD BUG: Only allowed role === 'club_head', so any student
   assigned as Member / Vice President got redirected to /dashboard.
   
   FIX: Also allow students who have an approved user_clubs entry.
   Presidents (club_head role) always pass through.
============================================================ */

const db = require("../db");

module.exports = async function clubMiddleware(req, res, next) {
  const user = req.session?.user;

  if (!user) {
    if (req.headers.accept?.includes("application/json"))
      return res.status(401).json({ error: "Not authenticated" });
    return res.redirect("/login.html");
  }

  // Admin can always access club routes
  if (user.role === "admin") return next();

  // Club heads always pass
  if (user.role === "club_head") return next();

  // Students: check if they have an approved club membership
  if (user.role === "student") {
    try {
      const [[membership]] = await db.promise().query(
        "SELECT id FROM user_clubs WHERE user_id = ? AND status = 'approved' LIMIT 1",
        [user.id]
      );
      if (membership) return next();
    } catch (err) {
      console.error("[clubMiddleware] DB error:", err.message);
    }
  }

  // Not a club member — redirect HTML pages, 403 for API calls
  if (req.headers.accept?.includes("application/json"))
    return res.status(403).json({ error: "You are not a club member" });

  return res.redirect("/dashboard");
};