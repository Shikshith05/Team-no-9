// B24: forgot / reset password.
// PWM-F-003 (AC-PWM-F-003: link expires after 30 minutes, works once; TC-Auth-03),
// PRJ-SR-003 (TC-Sec-03: tokens issued before a reset are rejected),
// PRJ-SR-005 (lockout cleared), SAD 3.9, 4.3.4 (202, no account enumeration), 4.4.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app, pool, request, resetDatabase, createLoggedInUser, PASSWORD } from "./helpers";

const NEW_PASSWORD = "BlueRiver2027y";

beforeEach(resetDatabase);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const forgot = (email) => request(app).post("/api/auth/forgot-password").send({ email });
const reset = (token, password = NEW_PASSWORD) => request(app).post("/api/auth/reset-password").send({ token, password });
const login = (email, password) => request(app).post("/api/auth/login").send({ email, password });

// Asks for a link and returns the token from the development console line.
async function requestToken(email = "user@example.com") {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const res = await forgot(email);
  expect(res.status).toBe(202);
  const line = info.mock.calls.map((args) => args.join(" ")).find((text) => text.includes("reset-password?token="));
  info.mockRestore();
  return line ? decodeURIComponent(line.match(/token=([^\s]+)/)[1]) : null;
}

function expectResetError(res, code) {
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe(code);
  expect(Object.keys(res.body.error).sort()).toEqual(["code", "fields", "message"]);
}

describe("migration 011", () => {
  it("can run again on a database with users and reset tokens, keeping them", async () => {
    await createLoggedInUser("user@example.com");
    await requestToken();
    const sql = fs.readFileSync(path.resolve(__dirname, "../database/migrations/011_password_reset.sql"), "utf8");
    await pool.query(sql);
    await pool.query(sql);
    const { rows } = await pool.query(
      "SELECT (SELECT COUNT(*)::INT FROM users) AS users, (SELECT COUNT(*)::INT FROM password_reset_tokens) AS tokens"
    );
    expect(rows[0]).toEqual({ users: 1, tokens: 1 });
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("gives exactly the same reply for an unknown email and a registered one (no enumeration)", async () => {
    await createLoggedInUser("user@example.com");
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const known = await forgot("user@example.com");
    const unknown = await forgot("nobody@example.com");
    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(unknown.body).toEqual(known.body);
    expect(known.body).toEqual({
      success: true,
      message: "If an account exists for that email, we've sent a link to reset the password."
    });
    const { rows } = await pool.query("SELECT COUNT(*)::INT AS n FROM password_reset_tokens");
    expect(rows[0].n).toBe(1);
  });

  it("an invalid email format is a 400 field error (says nothing about accounts)", async () => {
    const res = await forgot("not-an-email");
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Please correct the highlighted fields.",
      fields: [{ field: "email", message: "Enter a valid email address, like name@example.com." }]
    });
  });

  it("stores only the SHA-256 hash, with a 30-minute expiry; email case does not matter", async () => {
    const { user } = await createLoggedInUser("user@example.com");
    const token = await requestToken("  USER@Example.com ");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 random bytes

    const { rows } = await pool.query(
      "SELECT user_id, token_hash, used_at, EXTRACT(EPOCH FROM expires_at - created_at)::INT AS lifetime FROM password_reset_tokens"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: user.id, used_at: null, lifetime: 1800 });
    expect(rows[0].token_hash).toBe(crypto.createHash("sha256").update(token).digest("hex"));
    expect(rows[0].token_hash).not.toContain(token);
  });

  it("in production the link is not logged; outside production it is", async () => {
    await createLoggedInUser("user@example.com");
    expect(await requestToken()).toBeTruthy();

    vi.stubEnv("NODE_ENV", "production");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await forgot("user@example.com")).status).toBe(202);
    const logged = [...info.mock.calls, ...warn.mock.calls].map((args) => args.join(" ")).join("\n");
    expect(logged).not.toMatch(/token=|reset-password\?/);
    expect(logged).toContain("PASSWORD_RESET_REQUESTED"); // the event, with the user id only
    expect(logged).not.toContain("user@example.com");
  });

  it("a new request invalidates the older link", async () => {
    await createLoggedInUser("user@example.com");
    const first = await requestToken();
    const second = await requestToken();
    expect(second).not.toBe(first);

    expectResetError(await reset(first), "RESET_TOKEN_INVALID");
    expect((await reset(second)).status).toBe(200);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("sets the new password: login works with it and not with the old one", async () => {
    await createLoggedInUser("user@example.com");
    const token = await requestToken();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await reset(token);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect((await login("user@example.com", PASSWORD)).status).toBe(401);
    const fresh = await login("user@example.com", NEW_PASSWORD);
    expect(fresh.status).toBe(200);
    // The login right after the reset (same second) is accepted by protected routes.
    expect((await request(app).get("/api/assets").set("Authorization", `Bearer ${fresh.body.token}`)).status).toBe(200);

    const { rows } = await pool.query("SELECT password FROM users WHERE email = 'user@example.com'");
    expect(rows[0].password).toMatch(/^\$2[aby]\$/); // bcrypt, never plaintext (PRJ-SR-002)
  });

  it("a link works only once", async () => {
    await createLoggedInUser("user@example.com");
    const token = await requestToken();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await reset(token)).status).toBe(200);

    const again = await reset(token, "AnotherOne2028z");
    expectResetError(again, "RESET_TOKEN_USED");
    expect(again.body.error.message).toBe("This reset link has already been used.");
    expect((await login("user@example.com", NEW_PASSWORD)).status).toBe(200);
  });

  it("an expired link (older than 30 minutes) is rejected and changes nothing", async () => {
    await createLoggedInUser("user@example.com");
    const token = await requestToken();
    await pool.query("UPDATE password_reset_tokens SET expires_at = NOW() - INTERVAL '1 second'");

    const res = await reset(token);
    expectResetError(res, "RESET_TOKEN_EXPIRED");
    expect(res.body.error.message).toBe("This reset link has expired.");
    expect((await login("user@example.com", PASSWORD)).status).toBe(200);
  });

  it("an unknown, missing or malformed token is rejected", async () => {
    expectResetError(await reset("made-up-token"), "RESET_TOKEN_INVALID");
    expectResetError(await reset(undefined), "RESET_TOKEN_INVALID");
    expectResetError(await reset(12345), "RESET_TOKEN_INVALID");
    expectResetError(await reset("x".repeat(201)), "RESET_TOKEN_INVALID");
  });

  it("a weak password is rejected with the registration policy, and the link stays usable", async () => {
    await createLoggedInUser("user@example.com");
    const token = await requestToken();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    for (const [password, message] of [
      ["short1", "Password must be at least 10 characters."],
      ["onlyletterslong", "Password must include at least one number."],
      ["password123", "This password is too common. Choose another one."],
      [null, "Password is required."]
    ]) {
      const res = await reset(token, password);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", fields: [{ field: "password", message }] });
    }
    const { rows } = await pool.query("SELECT used_at FROM password_reset_tokens");
    expect(rows[0].used_at).toBeNull();
    expect((await reset(token)).status).toBe(200);
  });

  it("every token issued before the reset is rejected afterwards (TC-Sec-03)", async () => {
    const phone = await createLoggedInUser("user@example.com");
    const laptop = await login("user@example.com", PASSWORD);
    const tokenTime = Math.floor(Date.now() / 1000);
    const token = await requestToken();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // The tokens above were issued in an earlier second than the reset.
    await vi.waitUntil(() => Math.floor(Date.now() / 1000) > tokenTime, { timeout: 2000, interval: 50 });
    expect((await reset(token)).status).toBe(200);

    for (const auth of [phone.auth, `Bearer ${laptop.body.token}`]) {
      const res = await request(app).get("/api/assets").set("Authorization", auth);
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({
        code: "UNAUTHORIZED",
        message: "Your password was changed. Please log in again.",
        fields: []
      });
    }
  });

  it("clears a lockout (PRJ-SR-005)", async () => {
    await createLoggedInUser("user@example.com");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 5; i++) await login("user@example.com", "WrongPassword99");
    expect((await login("user@example.com", PASSWORD)).status).toBe(423);

    const token = await requestToken();
    expect((await reset(token)).status).toBe(200);

    const { rows } = await pool.query("SELECT failed_login_attempts, lock_until FROM users");
    expect(rows[0]).toEqual({ failed_login_attempts: 0, lock_until: null });
    expect((await login("user@example.com", NEW_PASSWORD)).status).toBe(200);
  });

  it("the reset endpoints need no token, and other users are not affected", async () => {
    const other = await createLoggedInUser("other@example.com");
    await createLoggedInUser("user@example.com");
    const token = await requestToken("user@example.com");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await reset(token)).status).toBe(200);

    expect((await request(app).get("/api/assets").set("Authorization", other.auth)).status).toBe(200);
    expect((await login("other@example.com", PASSWORD)).status).toBe(200);
  });
});
