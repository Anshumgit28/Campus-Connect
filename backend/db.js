const mysql = require("mysql2");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "minor_project",
  port: 3307, // change if needed

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db;
   