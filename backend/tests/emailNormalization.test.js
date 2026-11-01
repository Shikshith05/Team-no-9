// B3 (#56): email addresses are case- and whitespace-insensitive.
import fs from "fs";
import path from "path";
import { beforeEach, describe, expect, it } from "vitest";
import { app, pool, request, PASSWORD, resetDatabase, registerUser } from "./helpers";

beforeEach(resetDatabase);

describe("registration", () => {
  it("stores the email trimmed and lowercased", async () => {
    const res = await registerUser({ email: "  User@Example.COM  " });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("user@example.com");
    const { rows } = await pool.query("SELECT email FROM users");
    expect(rows).toEqual([{ email: "user@example.com" }]);
  });

  it("rejects the same email with different casing as already registered", async () => {
    expect((await registerUser({ email: "User@Example.com" })).status).toBe(201);
    const again = await registerUser({ email: "user@example.com" });
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(again.status).toBeLessThan(500);
    expect(again.body.message ?? again.body.error?.message).toMatch(/already registered/i);
  });

  it("rejects the same email with surrounding whitespace", async () => {
    expect((await registerUser({ email: "user@example.com" })).status).toBe(201);
    const again = await registerUser({ email: "  USER@example.com\t" });
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(again.status).toBeLessThan(500);
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
    expect(rows[0].n).toBe(1);
  });

  it("is enforced by the database too (unique index on LOWER(email))", async () => {
    await pool.query("INSERT INTO users (name, email, password) VALUES ('a', 'dup@example.com', 'x')");
    await expect(
      pool.query("INSERT INTO users (name, email, password) VALUES ('b', 'DUP@example.com', 'x')")
    ).rejects.toMatchObject({ code: "23505" });
  });
});

describe("login", () => {
  it("works whatever casing and spacing the user types", async () => {
    await registerUser({ email: "user@example.com" });
    for (const email of ["USER@EXAMPLE.COM", "  User@Example.com ", "user@example.com"]) {
      const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
      expect(res.status, email).toBe(200);
      expect(res.body.user.email).toBe("user@example.com");
    }
  });

  it("counts failed attempts on the one account regardless of casing", async () => {
    await registerUser({ email: "user@example.com" });
    const variants = ["USER@example.com", "user@EXAMPLE.com", " user@example.com", "User@Example.com", "user@example.COM"];
    for (const email of variants) {
      await request(app).post("/api/auth/login").send({ email, password: "WrongPass123" });
    }
    const res = await request(app).post("/api/auth/login").send({ email: "user@example.com", password: PASSWORD });
    expect(res.status).toBe(423);
  });
});

describe("migration 008", () => {
  const sql = fs
    .readFileSync(path.resolve(__dirname, "../database/migrations/008_case_insensitive_user_email.sql"), "utf8")
    .replace(/^﻿/, "");

  // Run the migration inside a transaction that is always rolled back, on
  // data that existed before it (so the index is removed first).
  async function runOnLegacyData(rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DROP INDEX idx_users_email_lower");
      for (const [i, email] of rows.entries()) {
        await client.query("INSERT INTO users (name, email, password) VALUES ($1, $2, 'x')", [`u${i}`, email]);
      }
      await client.query(sql);
      return (await client.query("SELECT email FROM users ORDER BY id")).rows.map((r) => r.email);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }

  it("normalizes existing emails without losing any account", async () => {
    expect(await runOnLegacyData(["Alice@Example.com", " bob@example.com ", "carol@example.com"])).toEqual([
      "alice@example.com",
      "bob@example.com",
      "carol@example.com"
    ]);
  });

  it("refuses to run (and changes nothing) when accounts already collide", async () => {
    await expect(runOnLegacyData(["Dup@Example.com", "dup@example.com", "other@example.com"])).rejects.toThrow(
      /differ only by case or spaces: dup@example\.com \(user ids 1, 2\)/
    );
  });
});
