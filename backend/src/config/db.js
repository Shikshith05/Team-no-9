
const { Pool } = require("pg");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../../.env")
});

// Use the dedicated test database during automated tests.
// Use the development database for normal development.
const database =
  process.env.NODE_ENV === "test"
    ? process.env.POSTGRES_DB
    : process.env.DEV_POSTGRES_DB || process.env.POSTGRES_DB;

const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database
});

// Handle idle PostgreSQL connection errors.
pool.on("error", (error) => {
  console.error("Idle database connection failed:", error.message);
});

module.exports = pool;
