// B6 (#55): every error uses the SAD format and never leaks internals.
//   {"error":{"code","message","fields"}}  (read by frontend/src/api/http.js)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import { app, pool, request, resetDatabase, createLoggedInUser, createAsset } from "./helpers";

beforeEach(resetDatabase);
afterEach(() => vi.restoreAllMocks());

function expectSadError(res, status, code) {
  expect(res.status).toBe(status);
  expect(Object.keys(res.body)).toEqual(["error"]);
  expect(Object.keys(res.body.error).sort()).toEqual(["code", "fields", "message"]);
  expect(res.body.error.code).toBe(code);
  expect(typeof res.body.error.message).toBe("string");
  expect(Array.isArray(res.body.error.fields)).toBe(true);
}

describe("validation errors (400)", () => {
  it("asset create lists each invalid field", async () => {
    const { auth } = await createLoggedInUser();
    const res = await request(app)
      .post("/api/assets")
      .set("Authorization", auth)
      .send({ assetName: "", value: "abc", purchaseDate: "2026-02-30" });
    expectSadError(res, 400, "VALIDATION_ERROR");
    expect(res.body.error.fields).toEqual([
      { field: "assetName", message: "Asset name must not be empty." },
      { field: "assetType", message: "Asset type is required." },
      { field: "value", message: "Value must be a number." },
      { field: "purchaseDate", message: "Purchase date must be a valid date (YYYY-MM-DD)." }
    ]);
  });

  it("values the database cannot store are a 400, not a raw database error", async () => {
    const { auth } = await createLoggedInUser();
    const huge = await request(app).post("/api/assets").set("Authorization", auth).send({ assetName: "x", assetType: "cash_bank", value: 1e20 });
    expectSadError(huge, 400, "VALIDATION_ERROR");
    expect(huge.body.error.fields).toEqual([{ field: "value", message: "Value is too large." }]);

    const negative = await request(app).post("/api/assets").set("Authorization", auth).send({ assetName: "x", assetType: "cash_bank", value: -5 });
    expect(negative.body.error.fields).toEqual([{ field: "value", message: "Value cannot be negative." }]);
  });

  it("malformed JSON is a 400 VALIDATION_ERROR", async () => {
    const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send('{"email":');
    expectSadError(res, 400, "VALIDATION_ERROR");
    expect(res.body.error.message).toBe("Request body must be valid JSON.");
  });
});

describe("authentication errors (401)", () => {
  it("missing, malformed, expired and revoked tokens all get UNAUTHORIZED", async () => {
    const { auth } = await createLoggedInUser();
    const expired = jwt.sign({ id: 1, email: "user@example.com" }, process.env.JWT_SECRET, { expiresIn: -10 });

    expectSadError(await request(app).get("/api/assets/dashboard-summary"), 401, "UNAUTHORIZED");
    expectSadError(await request(app).get("/api/assets/dashboard-summary").set("Authorization", "Bearer not-a-jwt"), 401, "UNAUTHORIZED");
    expectSadError(await request(app).get("/api/assets/dashboard-summary").set("Authorization", `Bearer ${expired}`), 401, "UNAUTHORIZED");

    await request(app).post("/api/auth/logout").set("Authorization", auth);
    const revoked = await request(app).get("/api/reports/export/csv").set("Authorization", auth);
    expectSadError(revoked, 401, "UNAUTHORIZED");
    expect(revoked.body.error.message).toMatch(/revoked/);
  });

  it("a token signed with another secret is rejected", async () => {
    const forged = jwt.sign({ id: 1, email: "user@example.com" }, "some-other-secret");
    expectSadError(await request(app).get("/api/assets/dashboard-summary").set("Authorization", `Bearer ${forged}`), 401, "UNAUTHORIZED");
  });
});

describe("not found (404)", () => {
  it("another user's asset, a deleted asset and a malformed id all look the same", async () => {
    const owner = await createLoggedInUser("owner@example.com");
    const other = await createLoggedInUser("other@example.com");
    const asset = await createAsset(owner.auth);

    for (const id of [asset.id, 999999, "abc", "1.5", "-3"]) {
      const res = await request(app).put(`/api/assets/${id}`).set("Authorization", other.auth).send({ value: 1 });
      expectSadError(res, 404, "NOT_FOUND");
      expect(res.body.error.message).toBe("Asset not found.");
    }
  });

  it("unknown API routes answer in the same format", async () => {
    expectSadError(await request(app).get("/api/does-not-exist"), 404, "NOT_FOUND");
  });
});

describe("internal errors (500)", () => {
  // The database text below must never reach the client.
  const dbError = Object.assign(
    new Error('relation "assets" does not exist at character 15: SELECT * FROM assets WHERE user_id = $1; password=secret'),
    { code: "42P01" }
  );

  it("a database failure in a controller returns a generic INTERNAL_ERROR", async () => {
    const { auth } = await createLoggedInUser();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const realQuery = pool.query.bind(pool);
    vi.spyOn(pool, "query").mockImplementation((text, ...rest) =>
      String(text).includes("INSERT INTO assets") ? Promise.reject(dbError) : realQuery(text, ...rest)
    );

    const res = await request(app).post("/api/assets").set("Authorization", auth).send({ assetName: "x", assetType: "cash_bank", value: 1 });
    expectSadError(res, 500, "INTERNAL_ERROR");
    expect(res.body.error.message).toBe("Something went wrong. Please try again later.");
    expect(JSON.stringify(res.body)).not.toMatch(/relation|SELECT|password|42P01|stack/i);
    // The details are kept in the server log.
    expect(log).toHaveBeenCalledWith(expect.stringContaining("POST /api/assets failed"), dbError);
  });

  it("a database failure while checking a token is a 500, not a misleading 401", async () => {
    const { auth } = await createLoggedInUser();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(pool, "query").mockRejectedValue(dbError);

    const res = await request(app).get("/api/assets/dashboard-summary").set("Authorization", auth);
    expectSadError(res, 500, "INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toMatch(/relation|SELECT/);
  });

  it("a failing export returns INTERNAL_ERROR without details", async () => {
    const { auth } = await createLoggedInUser();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const realQuery = pool.query.bind(pool);
    vi.spyOn(pool, "query").mockImplementation((text, ...rest) =>
      String(text).includes("FROM assets") ? Promise.reject(dbError) : realQuery(text, ...rest)
    );

    const res = await request(app).get("/api/reports/export/csv").set("Authorization", auth);
    expectSadError(res, 500, "INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toMatch(/relation|SELECT/);
  });
});

describe("successful responses are unchanged", () => {
  it("login, create asset and dashboard keep their existing shapes", async () => {
    const { auth, token, user } = await createLoggedInUser();
    expect(typeof token).toBe("string");
    expect(Object.keys(user).sort()).toEqual(["email", "id", "name"]);

    const created = await request(app).post("/api/assets").set("Authorization", auth).send({ assetName: "Gold", assetType: "gold", value: "10.50" });
    expect(created.status).toBe(201);
    expect(created.body.success).toBe(true);
    expect(created.body.data.value).toBe("10.50");

    const summary = await request(app).get("/api/assets/dashboard-summary").set("Authorization", auth);
    expect(summary.body).toMatchObject({ success: true, totalNetWorth: 10.5 });
  });
});
