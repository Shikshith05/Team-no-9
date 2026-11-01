// Auth regression tests: register, login, lockout (PRJ-SR-005), logout (PRJ-SR-003).
import { beforeEach, describe, expect, it } from "vitest";
import { app, pool, request, PASSWORD, resetDatabase, registerUser, createLoggedInUser } from "./helpers";

beforeEach(resetDatabase);

describe("POST /api/auth/register", () => {
  it("creates a user and stores only a bcrypt hash", async () => {
    const res = await registerUser({ email: "new@example.com" });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: "Test User", email: "new@example.com" });
    expect(res.body.user.password).toBeUndefined();

    const { rows } = await pool.query("SELECT password FROM users WHERE email = $1", ["new@example.com"]);
    expect(rows[0].password).not.toBe(PASSWORD);
    expect(rows[0].password).toMatch(/^\$2[aby]\$/);
  });

  it("rejects a request with missing fields", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "x@example.com" });
    expect(res.status).toBe(400);
  });

  it("rejects an email that is already registered", async () => {
    await registerUser();
    const res = await registerUser();
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe("POST /api/auth/login", () => {
  it("returns a token for valid credentials", async () => {
    await registerUser();
    const res = await request(app).post("/api/auth/login").send({ email: "user@example.com", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user).toMatchObject({ email: "user@example.com" });
  });

  it("returns 401 for a wrong password and for an unknown email", async () => {
    await registerUser();
    const wrong = await request(app).post("/api/auth/login").send({ email: "user@example.com", password: "WrongPass123" });
    const unknown = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: PASSWORD });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
  });

  it("locks the account after 5 failed attempts: the 6th attempt returns 423", async () => {
    await registerUser();
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/api/auth/login").send({ email: "user@example.com", password: "WrongPass123" });
      expect(res.status).toBe(401);
    }
    // Even the correct password is refused while locked.
    const locked = await request(app).post("/api/auth/login").send({ email: "user@example.com", password: PASSWORD });
    expect(locked.status).toBe(423);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes the token so it can no longer be used", async () => {
    const { auth } = await createLoggedInUser();
    expect((await request(app).get("/api/assets/dashboard-summary").set("Authorization", auth)).status).toBe(200);

    const logout = await request(app).post("/api/auth/logout").set("Authorization", auth);
    expect(logout.status).toBe(200);

    const after = await request(app).get("/api/assets/dashboard-summary").set("Authorization", auth);
    expect(after.status).toBe(401);
  });

  it("requires a token", async () => {
    expect((await request(app).post("/api/auth/logout")).status).toBe(401);
  });
});
