"use strict";

/**
 * alumniMiddleware.js
 * Must be used AFTER authMiddleware.
 */
module.exports = function alumniOnly(req, res, next) {
  if (req.session?.user?.role !== "alumni") {
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(403).json({ error: "Access denied. Alumni only." });
    }
    return res.redirect("/dashboard");
  }
  next();
};