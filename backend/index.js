
const express = require("express");
const session = require("express-session");
const path = require("path");
const helmet = require("helmet");

const app = express();

/* =========================
   BODY PARSER (MOST IMPORTANT)
   Fixes fetch + profile saving
========================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


/* =========================
   SECURITY
=================== ====== */
app.use(helmet());


/* =========================
   SESSION CONFIG
========================= */

app.use(session({
  secret: "campus_connect_secret", // change in production
  resave: false,
  saveUninitialized: false,
  cookie: {
  secure: false,      // true in production (HTTPS)
  httpOnly: true,     // prevents JS from stealing session
  sameSite: "lax"     // protects from CSRF
}

}));


/* =========================
   STATIC FILES
========================= */

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

/* =========================
   ROUTES
========================= */

// AUTH
const authRoutes = require("./routes/auth");
app.use("/", authRoutes);

// DASHBOARD + PROFILE
const dashboardRoutes = require("./routes/dashboard");
app.use("/dashboard", dashboardRoutes);

// EVENTS
const eventRoutes = require("./routes/events");
app.use("/events", eventRoutes);

// ADMIN
const adminRoutes = require("./routes/admin");
app.use("/admin", adminRoutes);

// RESOURCES (NEW MODULE)
const resourceRoutes = require("./routes/resources");
app.use("/resources", resourceRoutes);
 
// ALUMNI MODULE
const alumniRoutes = require("./routes/alumni");
app.use("/alumni", alumniRoutes);


// FACULTY MODULE
const facultyRoutes = require("./routes/faculty");
app.use("/faculty", facultyRoutes);

// CLUB HEAD MODULE
const clubRoutes = require("./routes/club");
app.use("/club", clubRoutes);

/* =========================
   DEFAULT ROUTE
========================= */

app.get("/", (req, res) => {
  res.redirect("/login.html");
});


/* =========================
   SERVER START
========================= */

const PORT = 3000;

app.use((err, req, res, next) => {
  console.error("💥 GLOBAL ERROR:", err.stack);
  res.status(500).send("Something broke!");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

  