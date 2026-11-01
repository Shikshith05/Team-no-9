// B5 (#54): GET /api/assets, GET /api/assets/:id, PUT /api/assets/:id/valuation.
// Response shapes follow frontend/src/api/assets.js.
import { beforeEach, describe, expect, it } from "vitest";
import { app, pool, request, resetDatabase, createLoggedInUser, createAsset } from "./helpers";

beforeEach(resetDatabase);

const ASSET_KEYS = ["assetType", "currentValue", "id", "location", "name", "purchaseDate", "purchaseValue", "valuedAt"];

describe("authentication", () => {
  it("all three endpoints require a token", async () => {
    expect((await request(app).get("/api/assets")).status).toBe(401);
    expect((await request(app).get("/api/assets/1")).status).toBe(401);
    expect((await request(app).put("/api/assets/1/valuation").send({ value: "1.00" })).status).toBe(401);
  });
});

describe("GET /api/assets", () => {
  it("lists only the caller's active assets in the frontend's shape", async () => {
    const me = await createLoggedInUser("me@example.com");
    const other = await createLoggedInUser("other@example.com");
    await createAsset(me.auth, { assetName: "Flat, Adyar", assetType: "REAL_ESTATE", value: "8200000", purchaseDate: "2021-03-15" });
    const sold = await createAsset(me.auth, { assetName: "Sold plot", assetType: "REAL_ESTATE", value: 1 });
    await createAsset(other.auth, { assetName: "Their villa", assetType: "REAL_ESTATE", value: 1 });
    await request(app).delete(`/api/assets/${sold.id}`).set("Authorization", me.auth);

    const res = await request(app).get("/api/assets").set("Authorization", me.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, limit: 50, total: 1 });
    expect(res.body.items).toHaveLength(1);
    const [item] = res.body.items;
    expect(Object.keys(item).sort()).toEqual(ASSET_KEYS);
    expect(item).toMatchObject({
      assetType: "REAL_ESTATE",
      name: "Flat, Adyar",
      purchaseDate: "2021-03-15",
      currentValue: "8200000.00",
      location: null,
      purchaseValue: null
    });
    expect(item.valuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("filters by type, ignoring case", async () => {
    const { auth } = await createLoggedInUser();
    await createAsset(auth, { assetName: "Flat", assetType: "REAL_ESTATE" });
    await createAsset(auth, { assetName: "Plot", assetType: "real_estate" });
    await createAsset(auth, { assetName: "Savings", assetType: "CASH" });

    const res = await request(app).get("/api/assets?type=REAL_ESTATE").set("Authorization", auth);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((a) => a.name)).toEqual(["Flat", "Plot"]);
    expect(res.body.items.every((a) => a.assetType === "REAL_ESTATE")).toBe(true);

    const none = await request(app).get("/api/assets?type=GOLD").set("Authorization", auth);
    expect(none.body).toEqual({ items: [], page: 1, limit: 50, total: 0 });
  });

  it("paginates with page and limit; total counts all matching assets", async () => {
    const { auth } = await createLoggedInUser();
    for (let i = 1; i <= 5; i++) await createAsset(auth, { assetName: `Asset ${i}` });

    const page2 = await request(app).get("/api/assets?page=2&limit=2").set("Authorization", auth);
    expect(page2.body).toMatchObject({ page: 2, limit: 2, total: 5 });
    expect(page2.body.items.map((a) => a.name)).toEqual(["Asset 3", "Asset 4"]);

    const last = await request(app).get("/api/assets?page=3&limit=2").set("Authorization", auth);
    expect(last.body.items.map((a) => a.name)).toEqual(["Asset 5"]);

    const beyond = await request(app).get("/api/assets?page=9&limit=2").set("Authorization", auth);
    expect(beyond.body).toMatchObject({ items: [], total: 5 });
  });

  it("rejects bad pagination values with field errors", async () => {
    const { auth } = await createLoggedInUser();
    const res = await request(app).get("/api/assets?page=0&limit=500").set("Authorization", auth);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields).toEqual([
      { field: "page", message: "page must be a positive whole number." },
      { field: "limit", message: "limit must be at most 200." }
    ]);
    expect((await request(app).get("/api/assets?limit=abc").set("Authorization", auth)).status).toBe(400);
  });
});

describe("GET /api/assets/:id", () => {
  it("returns the caller's asset", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth, { assetName: "Flat", assetType: "real_estate", value: 100 });
    const res = await request(app).get(`/api/assets/${asset.id}`).set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(ASSET_KEYS);
    expect(res.body).toMatchObject({ id: asset.id, assetType: "REAL_ESTATE", name: "Flat", currentValue: "100.00" });
  });

  it("another user's asset, a deleted asset, a missing id and a malformed id are all 404", async () => {
    const owner = await createLoggedInUser("owner@example.com");
    const other = await createLoggedInUser("other@example.com");
    const asset = await createAsset(owner.auth);
    const deleted = await createAsset(other.auth);
    await request(app).delete(`/api/assets/${deleted.id}`).set("Authorization", other.auth);

    for (const id of [asset.id, deleted.id, 999999, "abc"]) {
      const res = await request(app).get(`/api/assets/${id}`).set("Authorization", other.auth);
      expect(res.status, String(id)).toBe(404);
      expect(res.body.error).toEqual({ code: "NOT_FOUND", message: "Asset not found.", fields: [] });
    }
  });
});

describe("PUT /api/assets/:id/valuation", () => {
  it("updates the value and returns the updated asset", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth, { assetType: "REAL_ESTATE", value: 6500000 });
    await pool.query("UPDATE assets SET updated_at = NOW() - INTERVAL '1 day' WHERE id = $1", [asset.id]);

    const res = await request(app).put(`/api/assets/${asset.id}/valuation`).set("Authorization", auth).send({ value: "8500000.00" });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(ASSET_KEYS);
    expect(res.body).toMatchObject({ id: asset.id, currentValue: "8500000.00" });
    expect(Date.now() - Date.parse(res.body.valuedAt)).toBeLessThan(60_000);

    const after = await request(app).get(`/api/assets/${asset.id}`).set("Authorization", auth);
    expect(after.body.currentValue).toBe("8500000.00");
  });

  it("is reflected in the dashboard total", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth, { assetType: "REAL_ESTATE", value: 100 });
    await request(app).put(`/api/assets/${asset.id}/valuation`).set("Authorization", auth).send({ value: "250.50" });
    const summary = await request(app).get("/api/assets/dashboard-summary").set("Authorization", auth);
    expect(summary.body.totalNetWorth).toBe(250.5);
  });

  it("does not write to valuations yet (blocked on B7, #63)", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth, { assetType: "REAL_ESTATE" });
    await request(app).put(`/api/assets/${asset.id}/valuation`).set("Authorization", auth).send({ value: "1.00" });
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM valuations");
    expect(rows[0].n).toBe(0);
  });

  it.each([
    ["negative", "-1"],
    ["text", "abc"],
    ["too many decimals", "12.345"],
    ["above ₹1,000 crore", "10000000000.01"],
    ["empty", ""],
    ["missing", undefined]
  ])("rejects a %s value", async (_label, value) => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth, { assetType: "REAL_ESTATE", value: 100 });
    const res = await request(app).put(`/api/assets/${asset.id}/valuation`).set("Authorization", auth).send({ value });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Check the highlighted field.",
      fields: [{ field: "value", message: "must be an amount from 0 to 10000000000.00 with at most 2 decimals" }]
    });
    const { rows } = await pool.query("SELECT value FROM assets WHERE id = $1", [asset.id]);
    expect(rows[0].value).toBe("100.00");
  });

  it("accepts the maximum value and a plain number", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth, { assetType: "REAL_ESTATE" });
    expect((await request(app).put(`/api/assets/${asset.id}/valuation`).set("Authorization", auth).send({ value: "10000000000.00" })).status).toBe(200);
    const res = await request(app).put(`/api/assets/${asset.id}/valuation`).set("Authorization", auth).send({ value: 1234.5 });
    expect(res.body.currentValue).toBe("1234.50");
  });

  it("another user's or a deleted asset is 404 and stays unchanged", async () => {
    const owner = await createLoggedInUser("owner@example.com");
    const other = await createLoggedInUser("other@example.com");
    const asset = await createAsset(owner.auth, { assetType: "REAL_ESTATE", value: 100 });

    const res = await request(app).put(`/api/assets/${asset.id}/valuation`).set("Authorization", other.auth).send({ value: "1.00" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");

    await request(app).delete(`/api/assets/${asset.id}`).set("Authorization", owner.auth);
    expect((await request(app).put(`/api/assets/${asset.id}/valuation`).set("Authorization", owner.auth).send({ value: "1.00" })).status).toBe(404);

    const { rows } = await pool.query("SELECT value FROM assets WHERE id = $1", [asset.id]);
    expect(rows[0].value).toBe("100.00");
  });

  it("refuses market-valued assets (stock, gold) with 422 MARKET_VALUED", async () => {
    const { auth } = await createLoggedInUser();
    const stock = await createAsset(auth, { assetName: "RELIANCE", assetType: "stock", value: 100 });
    const res = await request(app).put(`/api/assets/${stock.id}/valuation`).set("Authorization", auth).send({ value: "1.00" });
    expect(res.status).toBe(422);
    expect(res.body.error).toEqual({ code: "MARKET_VALUED", message: "This asset is valued from market prices.", fields: [] });
  });
});

describe("existing routes still work next to the new ones", () => {
  it("dashboard-summary is not mistaken for an asset id", async () => {
    const { auth } = await createLoggedInUser();
    const res = await request(app).get("/api/assets/dashboard-summary").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
