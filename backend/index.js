const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "minor_project",
  port: 3307
});

db.connect((err) => {
  if (err) {
    console.log("Database error:", err);
  } else {
    console.log("MySQL connected");
  }
});

// REGISTER
app.post("/register", (req, res) => {
  const { username, email, password } = req.body;

  db.query(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, password],
    (err) => {
      if (err) {
        res.send("Registration failed");
      } else {
        res.redirect("/login.html");
      }
    }
  );
});

// LOGIN
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email=? AND password=?",
    [email, password],
    (err, result) => {
      if (result.length > 0) {
        res.redirect("/dashboard.html");
      } else {
        res.send("Invalid credentials");
      }
    }
  );
});

// Server
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
