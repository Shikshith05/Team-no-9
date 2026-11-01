// Test database helper (B14).
// createFreshDatabase(): drops and recreates POSTGRES_DB, then applies
//   database/migrations/*.sql in filename order.
// truncateAll(): empties every table between tests.
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const MIGRATIONS_DIR = path.resolve(__dirname, "../../database/migrations");

function connectionConfig(database) {
  const missing = ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"].filter(
    (name) => !process.env[name]
  );
  if (missing.length > 0) {
    throw new Error(`Backend tests need these environment variables: ${missing.join(", ")}`);
  }
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database
  };
}

function testDatabaseName() {
  const name = process.env.POSTGRES_DB;
  // The database is dropped on every run, so refuse anything that does not
  // look like a dedicated test database.
  if (!/^[a-z0-9_]+_test$/.test(name || "")) {
    throw new Error(`POSTGRES_DB must be a dedicated test database ending in "_test" (got "${name}")`);
  }
  return name;
}

// Some migration files were saved with a UTF-8 byte-order mark.
function readMigration(file) {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8").replace(/^﻿/, "");
}

async function createFreshDatabase() {
  const name = testDatabaseName();

  const admin = new Client(connectionConfig("postgres"));
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  const client = new Client(connectionConfig(name));
  await client.connect();
  try {
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      await client.query(readMigration(file));
    }
    return files;
  } finally {
    await client.end();
  }
}

async function dropDatabase() {
  const admin = new Client(connectionConfig("postgres"));
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${testDatabaseName()}" WITH (FORCE)`);
  } finally {
    await admin.end();
  }
}

// Empties every table created by the migrations (and resets ID counters).
async function truncateAll(pool) {
  const { rows } = await pool.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"${r.tablename}"`).join(", ");
  await pool.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

module.exports = { createFreshDatabase, dropDatabase, truncateAll, testDatabaseName };
