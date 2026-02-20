"use strict";

/**
 * roleMiddleware.js
 * Reusable role-based access factory.
 *
 * Usage:
 *   const { allowRoles } = require("../middleware/roleMiddleware");
 *   router.use(auth, allowRoles("admin"));
 *   router.use(auth, allowRoles("faculty", "admin"));
 */
module.exports.allowRoles = function allowRoles(...roles) {
  return function roleGuard(req, res, next) {
    const userRole = req.session?.user?.role;
    if (!userRole || !roles.includes(userRole)) {
      if (req.headers.accept && req.headers.accept.includes("application/json")) {
        return res.status(403).json({
          error: `Access denied. Allowed roles: ${roles.join(", ")}`
        });
      }
      return res.redirect("/dashboard");
    }
    next();
  };
};