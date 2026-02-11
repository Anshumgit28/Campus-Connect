module.exports = function facultyOnly(req, res, next) {

  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  if (req.session.user.role !== "faculty") {
    return res.redirect("/dashboard");
  }

  next();
};
