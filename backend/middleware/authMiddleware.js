module.exports = function auth(req, res, next) {

  console.log("SESSION CHECK:", req.session);

  // MUST check user — not userId
  if (!req.session.user) {
    console.log("❌ NOT LOGGED IN");
    return res.redirect("/login.html");
  }

  next();
};
