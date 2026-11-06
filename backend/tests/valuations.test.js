import { beforeEach, describe, expect, it } from "vitest";
import {
  app,
  pool,
  request,
  resetDatabase,
  createLoggedInUser,
  createAsset
} from "./helpers";

beforeEach(resetDatabase);

async function insertValuation(asset, value, valuedAt, source = "MANUAL") {
  await pool.query(
    `INSERT INTO valuations
       (asset_type, asset_id, value, source, valued_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [asset.asset_type, asset.id, value, source, valuedAt]
  );
}

describe("GET /api/valuations/history", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/valuations/history");

    expect(res.status).toBe(401);
  });

  it("returns only the caller's active asset valuation history", async () => {
    const me = await createLoggedInUser("history-me@example.com");
    const other = await createLoggedInUser("history-other@example.com");

    const myAsset = await createAsset(me.auth, {
      assetName: "My Flat",
      assetType: "REAL_ESTATE"
    });

    const deletedAsset = await createAsset(me.auth, {
      assetName: "Deleted Flat",
      assetType: "REAL_ESTATE"
    });

    const otherAsset = await createAsset(other.auth, {
      assetName: "Other User Flat",
      assetType: "REAL_ESTATE"
    });

    await insertValuation(
      myAsset,
      "100.00",
      "2026-11-01T10:00:00Z"
    );

    await insertValuation(
      myAsset,
      "150.00",
      "2026-11-02T10:00:00Z"
    );

    await insertValuation(
      deletedAsset,
      "200.00",
      "2026-11-02T11:00:00Z"
    );

    await insertValuation(
      otherAsset,
      "900.00",
      "2026-11-02T12:00:00Z"
    );

    await request(app)
      .delete(`/api/assets/${deletedAsset.id}`)
      .set("Authorization", me.auth);

    const res = await request(app)
      .get("/api/valuations/history")
      .set("Authorization", me.auth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 1,
      limit: 200,
      total: 2
    });
    expect(res.body.items).toHaveLength(2);

    expect(res.body.items.map((item) => item.value)).toEqual([
      "150.00",
      "100.00"
    ]);

    expect(
      res.body.items.every((item) => item.assetId === myAsset.id)
    ).toBe(true);

    expect(
      res.body.items.every((item) => item.assetName === "My Flat")
    ).toBe(true);
  });

  it("filters history by assetId", async () => {
    const { auth } = await createLoggedInUser();
    const first = await createAsset(auth, { assetName: "First Flat" });
    const second = await createAsset(auth, { assetName: "Second Flat" });

    await insertValuation(first, "100.00", "2026-11-01T10:00:00Z");
    await insertValuation(second, "200.00", "2026-11-01T11:00:00Z");

    const res = await request(app)
      .get(`/api/valuations/history?assetId=${first.id}`)
      .set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 1,
      limit: 200,
      total: 1
    });
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].assetId).toBe(first.id);
    expect(res.body.items[0].value).toBe("100.00");
  });
  it("supports page and limit and returns the total matching count", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth);

    for (let i = 1; i <= 5; i++) {
      await insertValuation(
        asset,
        `${i * 100}.00`,
        `2026-11-01T10:0${i}:00Z`
      );
    }

    const res = await request(app)
      .get("/api/valuations/history?page=2&limit=2")
      .set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      page: 2,
      limit: 2,
      total: 5
    });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.map((item) => item.value)).toEqual([
      "300.00",
      "200.00"
    ]);
   });


   it("filters by an inclusive date range", async () => {
     const { auth } = await createLoggedInUser();
     const asset = await createAsset(auth);

     await insertValuation(asset, "100.00", "2026-10-31T10:00:00Z");
     await insertValuation(asset, "200.00", "2026-11-01T10:00:00Z");
     await insertValuation(asset, "300.00", "2026-11-02T10:00:00Z");

     const res = await request(app)
       .get("/api/valuations/history?from=2026-11-01&to=2026-11-01")
       .set("Authorization", auth);

     expect(res.status).toBe(200);
     expect(res.body.items).toHaveLength(1);
     expect(res.body.items[0].value).toBe("200.00");
   });

  it("does not expose another user's history when filtering by their assetId", async () => {
    const owner = await createLoggedInUser("history-owner@example.com");
    const other = await createLoggedInUser("history-viewer@example.com");

    const asset = await createAsset(owner.auth);
    await insertValuation(asset, "500.00", "2026-11-01T10:00:00Z");

    const res = await request(app)
      .get(`/api/valuations/history?assetId=${asset.id}`)
      .set("Authorization", other.auth);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("does not return legacy valuation rows without a unified asset reference", async () => {
    const { auth } = await createLoggedInUser();

    await pool.query(
      `INSERT INTO valuations
         (asset_type, asset_id, legacy_asset_id, value, source, valued_at)
       VALUES ('legacy_type', NULL, 98765, 100, 'MANUAL', NOW())`
    );

    const res = await request(app)
      .get("/api/valuations/history")
      .set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("rejects invalid filters", async () => {
    const { auth } = await createLoggedInUser();

    const badAssetId = await request(app)
      .get("/api/valuations/history?assetId=abc")
      .set("Authorization", auth);

    expect(badAssetId.status).toBe(400);
    expect(badAssetId.body.error.code).toBe("VALIDATION_ERROR");

    const badDate = await request(app)
      .get("/api/valuations/history?from=2026-02-30")
      .set("Authorization", auth);

    expect(badDate.status).toBe(400);
    expect(badDate.body.error.code).toBe("VALIDATION_ERROR");

    const badRange = await request(app)
      .get("/api/valuations/history?from=2026-11-03&to=2026-11-02")
      .set("Authorization", auth);

    expect(badRange.status).toBe(400);
    expect(badRange.body.error.code).toBe("VALIDATION_ERROR");

    const badPagination = await request(app)
      .get("/api/valuations/history?page=0&limit=201")
      .set("Authorization", auth);

    expect(badPagination.status).toBe(400);
    expect(badPagination.body.error.fields).toEqual([
      { field: "page", message: "page must be a positive whole number." },
      { field: "limit", message: "limit must be at most 200." }
    ]);
  });
});