"use strict";

/**
 * authMiddleware.js
 * Verifies the user is logged in via session.
 * - API calls (Accept: application/json) → 401 JSON
 * - Browser calls → redirect to /login.html
 */
module.exports = function authMiddleware(req, res, next) {
  if (!req.session?.user) {
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(401).json({ error: "Not authenticated. Please log in." });
    }
    return res.redirect("/login.html");
  }
  next();
};