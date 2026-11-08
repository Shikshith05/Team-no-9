// Applies database/migrations/*.sql in filename order (B15, #62). Each file runs
// once; schema_migrations records which ones are done. Used when the backend
// container starts, or by hand: npm run migrate
//
// /docker-entrypoint-initdb.d was not used because PostgreSQL only reads it for an
// empty data directory, so a new migration would never reach an existing database.
// The migrations are safe to re-run, so a database set up by hand (with no
// schema_migrations table yet) is handled too.
const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.resolve(__dirname, "../database/migrations");
const LOCK_ID = 720261; // Two starting containers must not migrate at the same time.

// `client` is a connected pg client. Returns the names of the files it applied.
async function runMigrations(client, dir = MIGRATIONS_DIR) {
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const done = new Set((await client.query("SELECT filename FROM schema_migrations")).rows.map((row) => row.filename));

    const applied = [];
    const files = fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      // Some files were saved with a UTF-8 byte-order mark.
      const sql = fs.readFileSync(path.join(dir, file), "utf8").replace(/^﻿/, "");
      try {
        await client.query(sql);
      } catch (error) {
        error.message = `Migration ${file} failed: ${error.message}`;
        throw error;
      }
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      applied.push(file);
    }
    return applied;
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]);
  }
}

async function main() {
  const pool = require("../src/config/db");
  const client = await pool.connect();
  try {
    const applied = await runMigrations(client);
    console.log(applied.length ? `Applied migrations: ${applied.join(", ")}` : "Database is up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { runMigrations };
