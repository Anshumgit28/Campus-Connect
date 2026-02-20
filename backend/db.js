"use strict";

const mysql = require("mysql2");

const pool = mysql.createPool({
  host:            process.env.DB_HOST || "localhost",
  port:            parseInt(process.env.DB_PORT || "3306", 10),
  user:            process.env.DB_USER || "root",
  password:        process.env.DB_PASSWORD || "",
  database:        process.env.DB_NAME || "minor_project",
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  enableKeepAlive:    true,
  keepAliveInitialDelay: 0
});

// Test connection on startup
pool.getConnection((err, conn) => {
  if (err) {
    console.error("❌ Database connection FAILED:", err.message);
    process.exit(1);
  }
  console.log("✅ Database connected successfully");
  conn.release();
});

module.exports = pool;