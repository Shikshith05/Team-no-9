// B16 lockout after expiry (PRJ-SR-005, TC-Sec-05), B17 token lifetime and B21
// unique tokens (PRJ-SR-003, TC-Sec-03), B18 security headers (TC-Sec-06), and the
// production JWT_SECRET check that goes with B19.
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app, pool, request, PASSWORD, resetDatabase, registerUser, createLoggedInUser } from "./helpers";
import { jwtSecretProblem } from "../src/utils/jwtSecret";

const EMAIL = "user@example.com";
const WRONG = "WrongPass123";

const login = (password = PASSWORD, email = EMAIL) => request(app).post("/api/auth/login").send({ email, password });

async function failLogins(times) {
  for (let i = 0; i < times; i++) {
    expect((await login(WRONG)).status).toBe(401);
  }
}

// The lock runs out without waiting 15 minutes (STP: time-dependent behaviour).
const expireLock = () => pool.query("UPDATE users SET lock_until = NOW() - INTERVAL '1 second'");

const lockState = async () =>
  (await pool.query("SELECT failed_login_attempts, lock_until FROM users WHERE email = $1", [EMAIL])).rows[0];

beforeEach(resetDatabase);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("B16: lockout after it expires (PRJ-SR-005, TC-Sec-05)", () => {
  beforeEach(async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await registerUser();
  });

  it("5 wrong passwords lock the account: the 6th attempt is 423, even with the right password", async () => {
    await failLogins(5);
    const locked = await login();
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("after the lock expires, one wrong password is 401 and does not lock again", async () => {
    await failLogins(5);
    await expireLock();

    expect((await login(WRONG)).status).toBe(401);

    const state = await lockState();
    expect(state.failed_login_attempts).toBe(1);
    expect(state.lock_until).toBeNull();
    expect((await login()).status).toBe(200);
  });

  it("after the lock expires, the right password is 200 and resets the count", async () => {
    await failLogins(5);
    await expireLock();

    expect((await login()).status).toBe(200);

    const state = await lockState();
    expect(state.failed_login_attempts).toBe(0);
    expect(state.lock_until).toBeNull();
  });

  it("after the lock expires, it takes 5 more wrong passwords to lock again", async () => {
    await failLogins(5);
    await expireLock();

    await failLogins(4);
    expect((await lockState()).lock_until).toBeNull();
    expect((await login()).status).toBe(200);

    await failLogins(5);
    expect((await login()).status).toBe(423);
  });

  it("a wrong password while locked does not extend the lock", async () => {
    await failLogins(5);
    const before = (await lockState()).lock_until;

    expect((await login(WRONG)).status).toBe(423);

    expect((await lockState()).lock_until).toEqual(before);
  });

  it("says when to retry, in the singular for the last minute", async () => {
    await failLogins(5);
    await pool.query("UPDATE users SET lock_until = NOW() + INTERVAL '30 seconds'");
    expect((await login()).body.error.message).toBe("Account locked after 5 failed attempts. Please retry in 1 minute.");
  });

  it("logs the lockout and blocked attempts to the server log, without secrets", async () => {
    await failLogins(4);
    expect(console.warn).not.toHaveBeenCalled();

    await failLogins(1);
    await login();

    const lines = console.warn.mock.calls.map(([line]) => JSON.parse(line));
    expect(lines.map((line) => line.event)).toEqual(["ACCOUNT_LOCKED", "LOGIN_BLOCKED_ACCOUNT_LOCKED"]);
    expect(lines[0]).toMatchObject({ userId: 1 });
    expect(Date.parse(lines[0].lockedUntil)).toBeGreaterThan(Date.now());

    const logged = JSON.stringify(console.warn.mock.calls);
    expect(logged).not.toContain(WRONG);
    expect(logged).not.toContain(PASSWORD);
    expect(logged).not.toContain(EMAIL);
  });
});

describe("B17: the token lifetime is configurable (PRJ-SR-003)", () => {
  async function tokenSeconds() {
    await registerUser();
    const res = await login();
    expect(res.status).toBe(200);
    const { iat, exp } = jwt.decode(res.body.token);
    return exp - iat;
  }

  it("defaults to 24 hours", async () => {
    vi.stubEnv("JWT_EXPIRES_IN", "");
    expect(await tokenSeconds()).toBe(24 * 60 * 60);
  });

  it("follows JWT_EXPIRES_IN", async () => {
    vi.stubEnv("JWT_EXPIRES_IN", "2h");
    expect(await tokenSeconds()).toBe(2 * 60 * 60);
  });

  it("reads a plain number as seconds, not milliseconds", async () => {
    vi.stubEnv("JWT_EXPIRES_IN", "3600");
    expect(await tokenSeconds()).toBe(3600);
  });

  it("rejects an expired token with 401 (TC-Sec-03)", async () => {
    const { user } = await createLoggedInUser();
    const expired = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get("/api/assets").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it("a badly configured lifetime is a generic 500, with no details for the client", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("JWT_EXPIRES_IN", "soon");
    await registerUser();
    const res = await login();
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("expiresIn");
  });
});

describe("B21: every login gets its own token (PRJ-SR-003)", () => {
  it("two logins in the same second give different tokens with a jti", async () => {
    await registerUser();
    const [first, second] = [(await login()).body.token, (await login()).body.token];
    expect(first).not.toBe(second);
    expect(jwt.decode(first).jti).toBeTruthy();
    expect(jwt.decode(first).jti).not.toBe(jwt.decode(second).jti);
  });

  it("logging in right after a logout gives a token that works", async () => {
    await registerUser();
    const old = (await login()).body.token;
    const logout = await request(app).post("/api/auth/logout").set("Authorization", `Bearer ${old}`);
    expect(logout.status).toBe(200);

    const fresh = (await login()).body.token;

    expect((await request(app).get("/api/assets").set("Authorization", `Bearer ${fresh}`)).status).toBe(200);
    expect((await request(app).get("/api/assets").set("Authorization", `Bearer ${old}`)).status).toBe(401);
  });
});

describe("B18: security headers (TC-Sec-06)", () => {
  it.each([
    ["a public route", "/health", 200],
    ["a protected route without a token", "/api/assets", 401],
    ["an unknown route", "/api/nope", 404]
  ])("are set on %s", async (_name, path, status) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(status);
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors");
    expect(res.headers["referrer-policy"]).toBeDefined();
  });
});

describe("jwtSecretProblem (B19)", () => {
  const strong = "a".repeat(64);

  it("allows anything outside production, so .env.example works locally", () => {
    expect(jwtSecretProblem({ NODE_ENV: "development", JWT_SECRET: "change_me_x" })).toBeNull();
    expect(jwtSecretProblem({ JWT_SECRET: "short" })).toBeNull();
  });

  it("refuses the placeholder and short secrets in production", () => {
    expect(jwtSecretProblem({ NODE_ENV: "production", JWT_SECRET: "change_me_generate_with_openssl_rand_hex_32" })).toMatch(/placeholder/);
    expect(jwtSecretProblem({ NODE_ENV: "production", JWT_SECRET: "short" })).toMatch(/at least 32/);
    expect(jwtSecretProblem({ NODE_ENV: "production" })).toMatch(/at least 32/);
  });

  it("accepts a strong secret in production", () => {
    expect(jwtSecretProblem({ NODE_ENV: "production", JWT_SECRET: strong })).toBeNull();
  });
});
