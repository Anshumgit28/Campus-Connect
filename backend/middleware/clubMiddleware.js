module.exports = function clubHeadOnly(req, res, next) {

  if (!req.session.user) {
    return res.redirect("/login.html");
  }

  if (req.session.user.role !== "club_head") {
    return res.redirect("/dashboard");
  }

  next();
};