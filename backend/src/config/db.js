
const { Pool } = require("pg");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../../.env")
});

const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.DEV_POSTGRES_DB || process.env.POSTGRES_DB
});

// PWM-NF-003: PostgreSQL restarting or dropping an idle connection must not end the
// API process. Node treats an "error" event with no listener as fatal. The pool
// opens a new connection for the next query, and until then requests get a 500 or 503.
pool.on("error", (error) => {
  console.error("Idle database connection failed:", error.message);
});

module.exports = pool;
