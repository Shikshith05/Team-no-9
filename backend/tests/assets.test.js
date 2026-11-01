// Asset regression tests: create, update, soft delete, ownership (PRJ-SR-004)
// and the dashboard summary.
import { beforeEach, describe, expect, it } from "vitest";
import { app, pool, request, resetDatabase, createLoggedInUser, createAsset } from "./helpers";

beforeEach(resetDatabase);

describe("asset CRUD", () => {
  it("requires authentication", async () => {
    expect((await request(app).post("/api/assets").send({ assetName: "x", assetType: "cash_bank", value: 1 })).status).toBe(401);
    expect((await request(app).get("/api/assets/dashboard-summary")).status).toBe(401);
  });

  it("creates an asset owned by the logged-in user", async () => {
    const { auth, user } = await createLoggedInUser();
    const asset = await createAsset(auth, { assetName: "Savings", assetType: "cash_bank", value: 25000 });
    expect(asset).toMatchObject({ user_id: user.id, asset_name: "Savings", asset_type: "cash_bank", value: "25000.00" });
  });

  it("rejects a negative value", async () => {
    const { auth } = await createLoggedInUser();
    const res = await request(app).post("/api/assets").set("Authorization", auth).send({ assetName: "x", assetType: "cash_bank", value: -1 });
    expect(res.status).toBe(400);
  });

  it("updates an asset", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth);
    const res = await request(app).put(`/api/assets/${asset.id}`).set("Authorization", auth).send({ value: 6000000 });
    expect(res.status).toBe(200);
    expect(res.body.data.value).toBe("6000000.00");
  });

  it("soft-deletes an asset: the row stays, with deleted_at set", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth);
    const res = await request(app).delete(`/api/assets/${asset.id}`).set("Authorization", auth);
    expect(res.status).toBe(200);

    const { rows } = await pool.query("SELECT deleted_at FROM assets WHERE id = $1", [asset.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].deleted_at).not.toBeNull();

    // A deleted asset can no longer be updated or deleted.
    expect((await request(app).put(`/api/assets/${asset.id}`).set("Authorization", auth).send({ value: 1 })).status).toBe(404);
    expect((await request(app).delete(`/api/assets/${asset.id}`).set("Authorization", auth)).status).toBe(404);
  });

  it("user A cannot edit or delete user B's asset (404, and the asset is unchanged)", async () => {
    const owner = await createLoggedInUser("owner@example.com");
    const intruder = await createLoggedInUser("intruder@example.com");
    const asset = await createAsset(owner.auth, { value: 100 });

    expect((await request(app).put(`/api/assets/${asset.id}`).set("Authorization", intruder.auth).send({ value: 1 })).status).toBe(404);
    expect((await request(app).delete(`/api/assets/${asset.id}`).set("Authorization", intruder.auth)).status).toBe(404);

    const { rows } = await pool.query("SELECT value, deleted_at FROM assets WHERE id = $1", [asset.id]);
    expect(rows[0]).toEqual({ value: "100.00", deleted_at: null });
  });
});

describe("GET /api/assets/dashboard-summary", () => {
  it("totals only the caller's non-deleted assets", async () => {
    const me = await createLoggedInUser("me@example.com");
    const other = await createLoggedInUser("other@example.com");
    await createAsset(me.auth, { assetType: "real_estate", value: 1000 });
    await createAsset(me.auth, { assetType: "cash_bank", value: 200 });
    const gone = await createAsset(me.auth, { assetType: "cash_bank", value: 999 });
    await createAsset(other.auth, { assetType: "real_estate", value: 50000 });
    await request(app).delete(`/api/assets/${gone.id}`).set("Authorization", me.auth);

    const res = await request(app).get("/api/assets/dashboard-summary").set("Authorization", me.auth);
    expect(res.status).toBe(200);
    expect(res.body.totalNetWorth).toBe(1200);
    const byType = Object.fromEntries(res.body.allocation.map((a) => [a.asset_type, a.total_value]));
    expect(byType).toEqual({ real_estate: "1000.00", cash_bank: "200.00" });
  });
});
