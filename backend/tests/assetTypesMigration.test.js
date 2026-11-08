// B22: migration 010 on a database that already holds assets, and re-running it.
// Uses its own throwaway database, not the shared test database.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "../src/config/db"; // loads the root .env, if there is one
import { runMigrations } from "../scripts/migrate";

const DB_NAME = `${process.env.POSTGRES_DB}_b22`;
const MIGRATIONS_DIR = path.resolve(__dirname, "../database/migrations");
const MIGRATION_010 = "010_asset_type_fields.sql";

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

beforeAll(async () => {
  expect(DB_NAME).toMatch(/^[a-z0-9_]+_test_b22$/);
  await asAdmin(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
  await asAdmin(`CREATE DATABASE "${DB_NAME}"`);
  client = new Client(connection(DB_NAME));
  await client.connect();
});

afterAll(async () => {
  await client?.end();
  await asAdmin(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
});

describe("migration 010 on existing data", () => {
  it("maps known spellings, keeps unknown types and the originals, and re-runs cleanly", async () => {
    // 1. The schema as it was before B22: every migration up to 009.
    const before = fs.mkdtempSync(path.join(os.tmpdir(), "pwm-b22-"));
    for (const file of fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql") && f < "010")) {
      fs.copyFileSync(path.join(MIGRATIONS_DIR, file), path.join(before, file));
    }
    await runMigrations(client, before);

    // 2. Free-text asset types as the old API stored them, plus a valuation row.
    const { rows: users } = await client.query(
      "INSERT INTO users (name, email, password) VALUES ('Old user', 'old@example.com', 'x') RETURNING id"
    );
    const userId = users[0].id;
    const legacy = [
      ["Flat", "real_estate", "5000000.00"],
      ["Plot", "Real Estate", "100.00"],
      ["Coins", "gold", "645000.00"],
      ["Shares", "Stock", "1200000.00"],
      ["Wallet", "cash_bank", "300.00"],
      ["Savings", "CASH", "1000.00"],
      ["Mystery", "banana", "42.00"]
    ];
    const ids = {};
    for (const [name, type, value] of legacy) {
      const { rows } = await client.query(
        "INSERT INTO assets (user_id, asset_name, asset_type, value) VALUES ($1, $2, $3, $4) RETURNING id",
        [userId, name, type, value]
      );
      ids[name] = rows[0].id;
    }
    await client.query("INSERT INTO valuations (asset_type, asset_id, value, source) VALUES ('real_estate', $1, 4900000, 'MANUAL')", [
      ids.Flat
    ]);

    // 3. Apply 010 through the real runner, as the backend container does.
    expect(await runMigrations(client)).toEqual(
      fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql") && f >= "010").sort()
    );

    const snapshot = async () =>
      (
        await client.query(
          "SELECT asset_name, asset_type, legacy_asset_type, value::TEXT FROM assets ORDER BY id"
        )
      ).rows;
    const after = await snapshot();
    expect(after).toEqual([
      { asset_name: "Flat", asset_type: "REAL_ESTATE", legacy_asset_type: "real_estate", value: "5000000.00" },
      { asset_name: "Plot", asset_type: "REAL_ESTATE", legacy_asset_type: "Real Estate", value: "100.00" },
      { asset_name: "Coins", asset_type: "GOLD", legacy_asset_type: "gold", value: "645000.00" },
      { asset_name: "Shares", asset_type: "STOCK", legacy_asset_type: "Stock", value: "1200000.00" },
      { asset_name: "Wallet", asset_type: "CASH", legacy_asset_type: "cash_bank", value: "300.00" },
      { asset_name: "Savings", asset_type: "CASH", legacy_asset_type: null, value: "1000.00" },
      // Unknown: unchanged, still counted, and recorded as its own legacy type.
      { asset_name: "Mystery", asset_type: "banana", legacy_asset_type: "banana", value: "42.00" }
    ]);
    // No rows lost, valuation history and its foreign key intact.
    const { rows: valuations } = await client.query("SELECT asset_id::INT FROM valuations");
    expect(valuations).toEqual([{ asset_id: ids.Flat }]);

    // The unknown row may keep its type, and its value can still change...
    await client.query("UPDATE assets SET value = 50 WHERE id = $1", [ids.Mystery]);
    // ...but it cannot become another unknown type, and new rows must be canonical.
    await expect(client.query("UPDATE assets SET asset_type = 'apple' WHERE id = $1", [ids.Mystery])).rejects.toThrow(
      /ck_assets_asset_type/
    );
    await expect(
      client.query("INSERT INTO assets (user_id, asset_name, asset_type, value) VALUES ($1, 'x', 'real_estate', 1)", [userId])
    ).rejects.toThrow(/ck_assets_asset_type/);

    // 4. Re-running: the runner skips it, and the file itself is safe to run again.
    expect(await runMigrations(client)).toEqual([]);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, MIGRATION_010), "utf8");
    await client.query(sql);
    await client.query(sql);
    const again = await snapshot();
    expect(again.map(({ asset_type, legacy_asset_type }) => [asset_type, legacy_asset_type])).toEqual(
      after.map(({ asset_type, legacy_asset_type }) => [asset_type, legacy_asset_type])
    );

    const { rows: constraints } = await client.query(
      "SELECT COUNT(*)::INT AS n FROM pg_constraint WHERE conrelid = 'assets'::regclass AND conname LIKE 'ck_assets_%'"
    );
    expect(constraints[0].n).toBe(10);
  });
});
