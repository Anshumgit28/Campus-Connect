"use strict";

const Response = require("../utils/responseFormatter");

module.exports = function studentOnly(req, res, next) {
  if (req.session?.user?.role !== "student") {
    if (req.xhr || req.headers.accept?.includes("application/json")) {
      return Response.forbidden(res, "Student access only");
    }
    return res.redirect("/dashboard");
  }
  next();
};