// B4 (#57): server-side registration validation (SAD password policy).
import { beforeEach, describe, expect, it } from "vitest";
import { pool, PASSWORD, resetDatabase, registerUser } from "./helpers";

beforeEach(resetDatabase);

async function expectFieldError(body, field, message) {
  const res = await registerUser(body);
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe("VALIDATION_ERROR");
  expect(res.body.error.fields).toContainEqual({ field, message });
  const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
  expect(rows[0].n).toBe(0); // nothing was created
}

describe("email format", () => {
  it.each(["not-an-email", "user@", "@example.com", "user@example", "us er@example.com", "a@b@c.com"])(
    "rejects %s",
    (email) => expectFieldError({ email }, "email", "Enter a valid email address, like name@example.com.")
  );

  it("rejects an email longer than 254 characters", () =>
    expectFieldError({ email: `${"a".repeat(250)}@x.com` }, "email", "Enter a valid email address, like name@example.com."));

  it("requires an email", () => expectFieldError({ email: "   " }, "email", "Email is required."));
});

describe("password policy", () => {
  it("rejects passwords shorter than 10 characters", () =>
    expectFieldError({ password: "abcde1234" }, "password", "Password must be at least 10 characters."));

  it("rejects passwords longer than 128 characters", () =>
    expectFieldError({ password: `a1${"x".repeat(127)}` }, "password", "Password must be at most 128 characters."));

  it("requires at least one digit", () =>
    expectFieldError({ password: "onlyletters" }, "password", "Password must include at least one number."));

  it("requires at least one letter", () =>
    expectFieldError({ password: "1234567890" }, "password", "Password must include at least one letter."));

  it("rejects common passwords, whatever the casing", () =>
    expectFieldError({ password: "Password1234" }, "password", "This password is too common. Choose another one."));

  it("requires a password", () => expectFieldError({ password: "" }, "password", "Password is required."));
});

describe("other fields", () => {
  it("requires a name", () => expectFieldError({ name: " " }, "name", "Name is required."));

  it("reports every invalid field at once", async () => {
    const res = await registerUser({ name: "", email: "nope", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.map((f) => f.field)).toEqual(["name", "email", "password"]);
  });
});

describe("valid requests", () => {
  it("accepts exactly 10 and exactly 128 characters", async () => {
    expect((await registerUser({ email: "ten@example.com", password: "abcdefgh12" })).status).toBe(201);
    expect((await registerUser({ email: "max@example.com", password: `a1${"x".repeat(126)}` })).status).toBe(201);
  });

  it("creates the account and stores a hash, never the plain password", async () => {
    const res = await registerUser({ email: "ok@example.com" });
    expect(res.status).toBe(201);
    const { rows } = await pool.query("SELECT password FROM users WHERE email = 'ok@example.com'");
    expect(rows[0].password).not.toBe(PASSWORD);
    expect(rows[0].password).toMatch(/^\$2[aby]\$10\$/);
  });
});
