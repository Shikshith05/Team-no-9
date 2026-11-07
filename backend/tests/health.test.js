// B15 (#62): GET /api/health (SAD 4.3.2, PWM-NF-003): public, liveness and database
// readiness, with no details. /health is kept.
import { afterEach, describe, expect, it, vi } from "vitest";
import { app, pool, request } from "./helpers";

afterEach(() => vi.restoreAllMocks());

describe("GET /api/health", () => {
  it("answers 200 without a token when the database is reachable", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("answers 503 in the SAD error format, with no details, when the database is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(pool, "query").mockRejectedValueOnce(new Error("connect ECONNREFUSED 10.0.0.5:5432"));

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: "SERVICE_UNAVAILABLE", message: "Service unavailable.", fields: [] }
    });
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
    expect(console.error).toHaveBeenCalled();
  });
});

describe("when PostgreSQL drops an idle connection", () => {
  it("the API process survives (PWM-NF-003)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Node throws for an "error" event that has no listener, which would end the process.
    expect(() => pool.emit("error", new Error("terminating connection due to administrator command"))).not.toThrow();

    expect(console.error).toHaveBeenCalled();
  });
});

describe("GET /health", () => {
  it("is kept", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });
});
