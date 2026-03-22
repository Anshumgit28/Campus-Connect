"use strict";

require("dotenv").config();

const express    = require("express");
const session    = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path       = require("path");
const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");

const app = express();

/* ── BODY PARSING ── */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ── SECURITY ── */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  xssFilter: true,
  noSniff: true,
  frameguard: { action: "sameorigin" }
}));

/* ── RATE LIMITING ── */
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." }
}));

/* ── SESSION ── */
const sessionStoreOptions = {
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT || "3306", 10),
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "minor_project",
  createDatabaseTable: true,
  expiration: 1000 * 60 * 60 * 8,
  clearExpired: true,
  checkExpirationInterval: 1000 * 60 * 15,
  schema: {
    tableName: "sessions",
    columnNames: { session_id: "session_id", expires: "expires", data: "data" }
  }
};

const sessionStore = new MySQLStore(sessionStoreOptions);

app.use(session({
  key:    "campus_connect.sid",
  secret: process.env.SESSION_SECRET || "campus_connect_fallback_secret",
  store:  sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure:   process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict",
    maxAge:   1000 * 60 * 60 * 8
  }
}));

/* ── STATIC FILES ── */
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

/* ── ROUTES ── */
app.use("/",              require("./routes/auth"));
app.use("/dashboard",     require("./routes/dashboard"));
app.use("/events",        require("./routes/events"));
app.use("/resources",     require("./routes/resources"));
app.use("/admin",         require("./routes/admin"));
app.use("/alumni",        require("./routes/alumni"));
app.use("/faculty/courses", require("./routes/faculty-courses"));
app.use("/faculty",         require("./routes/faculty"));
app.use("/club",          require("./routes/club"));
app.use("/notifications", require("./routes/notifications"));
app.use("/courses",       require("./routes/courses"));

/* ── DEFAULT ── */
app.get("/", (req, res) => res.redirect("/login.html"));

/* ── 404 ── */
app.use((req, res) => {
  if (req.headers.accept?.includes("application/json"))
    return res.status(404).json({ error: "Route not found" });
  res.status(404).send("404 — Page not found");
});

/* ── ERROR HANDLER ── */
app.use((err, req, res, next) => {
  console.error("💥 UNHANDLED ERROR:", err.stack || err.message || err);
  if (res.headersSent) return next(err);
  if (req.headers.accept?.includes("application/json"))
    return res.status(500).json({ error: "Internal server error" });
  res.status(500).send("Something went wrong. Please try again.");
});

/* ── START ── */
const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, () => {
  console.log(`🚀 Campus Connect → http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;