const express = require("express");
const session = require("express-session");
const path = require("path");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: "campus-connect-secret",
  resave: false,
  saveUninitialized: true
}));

/* =========================
   STATIC FILES
========================= */
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   ROUTES
========================= */
app.use("/", require("./routes/auth"));
app.use("/", require("./routes/dashboard"));
app.use("/", require("./routes/admin"));

/* =========================
   DEFAULT ROUTE
========================= */
app.get("/", (req, res) => {
  res.redirect("/login.html");
});

/* =========================
   SERVER START
========================= */
app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
