"use strict";
const path = require("path");

/**
 * adminMiddleware.js
 * Must be used AFTER authMiddleware.
 */
module.exports = function adminOnly(req, res, next) {
  if (req.session?.user?.role !== "admin") {
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }
    // Try to serve a 403 page, fall back to text
    return res.status(403).sendFile(
      path.join(__dirname, "../public/403.html"),
      (err) => { if (err) res.status(403).send("Access denied. Admins only."); }
    );
  }
  next();
};