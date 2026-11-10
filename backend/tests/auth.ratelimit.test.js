const request = require("supertest");
const app = require("../src/app");
const { describe, it, expect, beforeAll, afterAll } = require("vitest");

describe("SAD 3.9: Auth Rate Limiting", () => {
  const OLD_LIMIT = process.env.AUTH_RATE_LIMIT;

  beforeAll(() => {
    process.env.AUTH_RATE_LIMIT = "3";
  });

  afterAll(() => {
    process.env.AUTH_RATE_LIMIT = OLD_LIMIT;
  });

  const TEST_IP = "203.0.113.77";

  it("4th failed login returns 429 in SAD format", async () => {
    for (let i = 0; i < 3; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", TEST_IP)
        .send({ email: "baduser@test.com", password: "wrongpassword" });
      expect(res.status).not.toBe(429);
    }

    const blockedRes = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", TEST_IP)
      .send({ email: "baduser@test.com", password: "wrongpassword" });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body).toEqual({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many attempts. Try again in 15 minutes.",
        fields: []
      }
    });
  });

  it("does not rate limit /logout or unauthenticated protected endpoints", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/auth/logout")
        .set("X-Forwarded-For", TEST_IP);
      expect(res.status).not.toBe(429);
    }
  });

  it("ensures different client IPs do not share a rate limit bucket", async () => {
    for (let i = 1; i <= 10; i++) {
      const res = await request(app)
        .post("/api/auth/register")
        .set("X-Forwarded-For", `198.51.100.${i}`)
        .send({});
      expect(res.status).not.toBe(429);
    }
  });
});

