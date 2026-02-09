module.exports = function adminOnly(req, res, next) {

  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  if (req.session.user.role !== "admin") {
    return res.redirect("/dashboard"); // better UX
  }

  next();
};
