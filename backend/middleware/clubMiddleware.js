"use strict";

/**
 * clubMiddleware.js
 * Must be used AFTER authMiddleware.
 */
module.exports = function clubHeadOnly(req, res, next) {
  if (req.session?.user?.role !== "club_head") {
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(403).json({ error: "Access denied. Club heads only." });
    }
    return res.redirect("/dashboard");
  }
  next();
};