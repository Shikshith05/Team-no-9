// B15 (#62): the migration runner used when the backend container starts.
// Uses its own throwaway database, not the shared test database.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import "../src/config/db"; // loads the root .env, if there is one
import { runMigrations } from "../scripts/migrate";

const DB_NAME = `${process.env.POSTGRES_DB}_migrate`;

const connection = (database) => ({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database
});

async function asAdmin(sql) {
  const admin = new Client(connection("postgres"));
  await admin.connect();
  try {
    await admin.query(sql);
  } finally {
    await admin.end();
  }
}

let client;
let dir;

function writeMigration(name, sql) {
  fs.writeFileSync(path.join(dir, name), sql);
}

beforeAll(() => {
  // The name is built from POSTGRES_DB, which the test setup has already checked.
  expect(DB_NAME).toMatch(/^[a-z0-9_]+_test_migrate$/);
});

beforeEach(async () => {
  await client?.end();
  await asAdmin(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
  await asAdmin(`CREATE DATABASE "${DB_NAME}"`);
  client = new Client(connection(DB_NAME));
  await client.connect();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "pwm-migrations-"));
});

afterAll(async () => {
  await client?.end();
  await asAdmin(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
});

describe("runMigrations", () => {
  it("applies the real migrations once, in filename order", async () => {
    const files = fs
      .readdirSync(path.resolve(__dirname, "../database/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    expect(await runMigrations(client)).toEqual(files);

    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rows.map(
      (row) => row.tablename
    );
    expect(tables).toEqual(expect.arrayContaining(["users", "assets", "valuations", "user_alerts", "token_blacklist"]));

    expect(await runMigrations(client)).toEqual([]);
  });

  it("handles a database that was set up by hand before the runner existed", async () => {
    await runMigrations(client);
    await client.query("DROP TABLE schema_migrations");

    await expect(runMigrations(client)).resolves.toHaveLength(
      fs.readdirSync(path.resolve(__dirname, "../database/migrations")).filter((file) => file.endsWith(".sql")).length
    );
  });

  it("runs files in filename order and applies only new ones on the next run", async () => {
    writeMigration("002_b.sql", "INSERT INTO log VALUES ('002');");
    writeMigration("001_a.sql", "CREATE TABLE log (name TEXT); INSERT INTO log VALUES ('001');");
    writeMigration("notes.txt", "not a migration");

    expect(await runMigrations(client, dir)).toEqual(["001_a.sql", "002_b.sql"]);

    writeMigration("003_c.sql", "INSERT INTO log VALUES ('003');");
    expect(await runMigrations(client, dir)).toEqual(["003_c.sql"]);

    const { rows } = await client.query("SELECT name FROM log");
    expect(rows.map((row) => row.name)).toEqual(["001", "002", "003"]);
  });

  it("copes with a byte-order mark at the start of a file", async () => {
    writeMigration("001_bom.sql", "﻿CREATE TABLE bom_ok (id INT);");
    await runMigrations(client, dir);
    expect((await client.query("SELECT to_regclass('bom_ok') AS name")).rows[0].name).toBe("bom_ok");
  });

  it("stops at a failing file, names it, and retries it on the next run", async () => {
    writeMigration("001_ok.sql", "CREATE TABLE first_ok (id INT);");
    writeMigration("002_bad.sql", "CREATE TABLE broken (;");
    writeMigration("003_later.sql", "CREATE TABLE later (id INT);");

    await expect(runMigrations(client, dir)).rejects.toThrow(/Migration 002_bad\.sql failed/);
    expect((await client.query("SELECT to_regclass('later') AS name")).rows[0].name).toBeNull();

    writeMigration("002_bad.sql", "CREATE TABLE fixed (id INT);");
    expect(await runMigrations(client, dir)).toEqual(["002_bad.sql", "003_later.sql"]);
  });
});
