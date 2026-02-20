"use strict";

/**
 * facultyMiddleware.js
 * Must be used AFTER authMiddleware.
 */
module.exports = function facultyOnly(req, res, next) {
  if (req.session?.user?.role !== "faculty") {
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(403).json({ error: "Access denied. Faculty only." });
    }
    return res.redirect("/dashboard");
  }
  next();
};