
"use strict";

// Load .env variables first
require("dotenv").config();

console.log("DB NAME:", process.env.DB_NAME);
console.log("DB USER:", process.env.DB_USER);

const express    = require("express");
const session    = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const path       = require("path");
const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");

const app = express();

/* ─────────────────────────────────────────
   1. BODY PARSING (with size limits)
───────────────────────────────────────── */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

/* ─────────────────────────────────────────
   2. SECURITY HEADERS (helmet)
───────────────────────────────────────── */
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  xssFilter: true,
  noSniff: true,
  frameguard: { action: "sameorigin" }
}));

/* ─────────────────────────────────────────
   3. GLOBAL RATE LIMITER
───────────────────────────────────────── */
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." }
}));
/* ─────────────────────────────────────────
   4. SESSION with MySQL store
───────────────────────────────────────── */
const sessionStoreOptions = {
  host:     process.env.DB_HOST     || "localhost",
  port:     parseInt(process.env.DB_PORT || "3307", 10),
  user:     process.env.DB_USER     || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "minor_project",
  createDatabaseTable: true,
  expiration: 1000 * 60 * 60 * 8, // 8 hours
  clearExpired: true,
  checkExpirationInterval: 1000 * 60 * 15, // Check every 15 min
  schema: {
    tableName: "sessions",
    columnNames: {
      session_id: "session_id",
      expires:    "expires",
      data:       "data"
    }
  }
};

const sessionStore = new MySQLStore(sessionStoreOptions);

app.use(session({
  key:    "campus_connect.sid",
  secret: process.env.SESSION_SECRET || "campus_connect_fallback_secret",
  store:  sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true, // ✅ IMPORTANT: Refresh cookie on each request
  cookie: {
    secure:   process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict", // ✅ Changed from "lax" to "strict"
    maxAge:   1000 * 60 * 60 * 8  // 8 hours
  }
}));

/* ─────────────────────────────────────────
   5. STATIC FILES
───────────────────────────────────────── */
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

/* ─────────────────────────────────────────
   6. ROUTES
───────────────────────────────────────── */
app.use("/",             require("./routes/auth"));
app.use("/dashboard",    require("./routes/dashboard"));
app.use("/events",       require("./routes/events"));
app.use("/resources",    require("./routes/resources"));
app.use("/admin",        require("./routes/admin"));
app.use("/alumni",       require("./routes/alumni"));
app.use("/faculty",      require("./routes/faculty"));
app.use("/club",         require("./routes/club"));
app.use("/notifications",require("./routes/notifications"));
app.use("/courses", require("./routes/courses"));

/* ─────────────────────────────────────────
   7. DEFAULT — root redirect
───────────────────────────────────────── */
app.get("/", (req, res) => res.redirect("/login.html"));

/* ─────────────────────────────────────────
   8. 404 HANDLER
───────────────────────────────────────── */
app.use((req, res) => {
  if (req.headers.accept && req.headers.accept.includes("application/json")) {
    return res.status(404).json({ error: "Route not found" });
  }
  res.status(404).send("404 — Page not found");
});

/* ─────────────────────────────────────────
   9. GLOBAL ERROR HANDLER
───────────────────────────────────────── */
app.use((err, req, res, next) => {
  console.error("💥 UNHANDLED ERROR:", err.stack || err.message || err);
  if (res.headersSent) return next(err);
  if (req.headers.accept && req.headers.accept.includes("application/json")) {
    return res.status(500).json({ error: "Internal server error" });
  }
  res.status(500).send("Something went wrong. Please try again.");
});

/* ─────────────────────────────────────────
   10. START SERVER
───────────────────────────────────────── */
const PORT = parseInt(process.env.PORT || "3000", 10);
app.listen(PORT, () => {
  console.log(`🚀 Campus Connect running → http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;