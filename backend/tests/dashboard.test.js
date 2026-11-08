// B11 (#61): GET /api/dashboard and GET /api/dashboard/trend
// (PWM-F-030, PWM-F-031, PWM-F-032, PRJ-SR-004; TC-Dash-01, TC-Dash-02, TC-Dash-03).
import { beforeEach, describe, expect, it } from "vitest";
import { app, pool, request, resetDatabase, createLoggedInUser, createAsset } from "./helpers";
import { buildAllocation } from "../src/utils/allocation";

beforeEach(resetDatabase);

const getDashboard = (auth) => request(app).get("/api/dashboard").set("Authorization", auth);
const getTrend = (auth, range) => request(app).get(`/api/dashboard/trend?range=${range}`).set("Authorization", auth);

async function istDay(interval = "0 days") {
  const { rows } = await pool.query(
    `SELECT TO_CHAR((NOW() AT TIME ZONE 'Asia/Kolkata')::DATE - $1::INTERVAL, 'YYYY-MM-DD') AS day`,
    [interval]
  );
  return rows[0].day;
}

async function backdateAsset(id, interval) {
  await pool.query("UPDATE assets SET created_at = NOW() - $2::INTERVAL WHERE id = $1", [id, interval]);
}

async function addValuation(asset, value, valuedAt) {
  await pool.query(
    "INSERT INTO valuations (asset_type, asset_id, value, source, valued_at) VALUES ($1, $2, $3, 'MANUAL', $4)",
    [asset.asset_type, asset.id, value, valuedAt]
  );
}

const softDelete = (auth, id) => request(app).delete(`/api/assets/${id}`).set("Authorization", auth);

describe("GET /api/dashboard", () => {
  it("requires a token (401 in the SAD error format)", async () => {
    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns zero and no allocation for an empty portfolio", async () => {
    const { auth } = await createLoggedInUser();
    const res = await getDashboard(auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ netWorth: "0.00", currency: "INR", hasStaleData: false, allocation: [] });
  });

  it("has the SAD 4.3.3 shape, with money and percent as decimal strings and asOf in UTC", async () => {
    const { auth } = await createLoggedInUser();
    await createAsset(auth, { assetType: "REAL_ESTATE", value: "8200000.00" });
    await createAsset(auth, { assetName: "Shares", assetType: "STOCK", value: "1200000.00" });
    await createAsset(auth, { assetName: "Coins", assetType: "GOLD", value: "645000.00" });
    await createAsset(auth, { assetName: "Savings", assetType: "CASH", value: "300000.00" });

    const { body } = await getDashboard(auth);

    expect(Object.keys(body).sort()).toEqual(["allocation", "asOf", "currency", "hasStaleData", "netWorth"]);
    expect(body.netWorth).toBe("10345000.00");
    expect(body.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
    expect(body.allocation).toEqual([
      { assetType: "REAL_ESTATE", value: "8200000.00", percent: "79.27" },
      { assetType: "STOCK", value: "1200000.00", percent: "11.60" },
      { assetType: "GOLD", value: "645000.00", percent: "6.23" },
      { assetType: "CASH", value: "300000.00", percent: "2.90" }
    ]);
  });

  it("TC-Dash-01: the total is the exact sum of the asset values", async () => {
    const { auth } = await createLoggedInUser();
    // 0.1 + 0.2 is 0.30000000000000004 in floating point.
    await createAsset(auth, { assetType: "CASH", value: "0.10" });
    await createAsset(auth, { assetType: "CASH", value: "0.20" });
    await createAsset(auth, { assetType: "GOLD", value: "9007199254740.99" });

    const { body } = await getDashboard(auth);

    expect(body.netWorth).toBe("9007199254741.29");
    expect(body.allocation.find((slice) => slice.assetType === "CASH").value).toBe("0.30");
  });

  it("excludes soft-deleted assets", async () => {
    const { auth } = await createLoggedInUser();
    await createAsset(auth, { assetType: "CASH", value: "100.00" });
    const removed = await createAsset(auth, { assetType: "GOLD", value: "900.00" });
    await softDelete(auth, removed.id);

    const { body } = await getDashboard(auth);

    expect(body.netWorth).toBe("100.00");
    expect(body.allocation).toEqual([{ assetType: "CASH", value: "100.00", percent: "100.00" }]);
  });

  it("never includes another user's assets (PRJ-SR-004)", async () => {
    const alice = await createLoggedInUser("alice@example.com");
    const bob = await createLoggedInUser("bob@example.com");
    await createAsset(alice.auth, { assetType: "CASH", value: "100.00" });
    await createAsset(bob.auth, { assetType: "GOLD", value: "5000.00" });

    expect((await getDashboard(alice.auth)).body).toMatchObject({
      netWorth: "100.00",
      allocation: [{ assetType: "CASH", value: "100.00", percent: "100.00" }]
    });
    expect((await getDashboard(bob.auth)).body.netWorth).toBe("5000.00");
  });

  it("TC-Dash-02: 3 equal classes at 33.33% add up to exactly 100.00", async () => {
    const { auth } = await createLoggedInUser();
    for (const assetType of ["REAL_ESTATE", "STOCK", "GOLD"]) {
      await createAsset(auth, { assetType, value: "100.00" });
    }

    const { body } = await getDashboard(auth);

    // The remainder goes to the first of the equally large slices.
    expect(body.allocation.map((slice) => slice.percent)).toEqual(["33.34", "33.33", "33.33"]);
    expect(body.allocation.map((slice) => slice.assetType)).toEqual(["REAL_ESTATE", "STOCK", "GOLD"]);
  });

  it("groups different spellings of an asset class under one slice", async () => {
    const { auth } = await createLoggedInUser();
    await createAsset(auth, { assetType: "real_estate", value: "10.00" });
    await createAsset(auth, { assetType: "REAL_ESTATE", value: "20.00" });
    await createAsset(auth, { assetType: "cash_bank", value: "5.00" });
    await createAsset(auth, { assetType: "CASH", value: "5.00" });

    const { body } = await getDashboard(auth);

    expect(body.allocation).toEqual([
      { assetType: "REAL_ESTATE", value: "30.00", percent: "75.00" },
      { assetType: "CASH", value: "10.00", percent: "25.00" }
    ]);
  });

  it("leaves classes worth nothing out of the chart", async () => {
    const { auth } = await createLoggedInUser();
    await createAsset(auth, { assetType: "CASH", value: "0" });
    expect((await getDashboard(auth)).body).toMatchObject({ netWorth: "0.00", allocation: [] });

    await createAsset(auth, { assetType: "GOLD", value: "50.00" });
    expect((await getDashboard(auth)).body.allocation).toEqual([
      { assetType: "GOLD", value: "50.00", percent: "100.00" }
    ]);
  });

  it("PWM-F-024: hasStaleData is true only when the user holds a class with a stale price", async () => {
    const holder = await createLoggedInUser("holder@example.com");
    const other = await createLoggedInUser("other@example.com");
    await createAsset(holder.auth, { assetType: "STOCK", value: "100.00" });
    await createAsset(other.auth, { assetType: "CASH", value: "100.00" });
    await pool.query(
      `INSERT INTO market_price_cache (asset_type, asset_id, price, fetched_at, is_stale)
       VALUES ('stock', 1, 10, NOW(), TRUE), ('gold', 1, 10, NOW(), FALSE)`
    );

    expect((await getDashboard(holder.auth)).body.hasStaleData).toBe(true);
    expect((await getDashboard(other.auth)).body.hasStaleData).toBe(false);
  });
});

describe("buildAllocation", () => {
  const total = (allocation) => allocation.reduce((sum, slice) => sum + Math.round(Number(slice.percent) * 100), 0);

  it("takes the remainder off the largest slice when the slices round up", () => {
    // 66.665, 16.6675 and 16.6675 round to 66.67 (half up), 16.67 and 16.67: 100.01.
    const { allocation } = buildAllocation([
      { assetType: "A", value: "6666.50" },
      { assetType: "B", value: "1666.75" },
      { assetType: "C", value: "1666.75" }
    ]);
    expect(allocation.map((slice) => slice.percent)).toEqual(["66.66", "16.67", "16.67"]);
  });

  it("always adds up to exactly 100.00", () => {
    for (const values of [
      ["1.00", "1.00", "1.00"],
      ["0.01", "0.01", "9999999.99"],
      ["7.00", "11.00", "13.00", "17.00", "19.00", "23.00", "29.00"],
      ["33.33", "33.33", "33.34"]
    ]) {
      const rows = values.map((value, i) => ({ assetType: `T${i}`, value }));
      expect(total(buildAllocation(rows).allocation)).toBe(10000);
    }
  });
});

describe("GET /api/dashboard/trend", () => {
  it("requires a token", async () => {
    const res = await request(app).get("/api/dashboard/trend?range=1M");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it.each(["", "range=1m", "range=2Y", "range=all", "range=1M&range=6M", "range=__proto__", "range=constructor"])(
    "answers 400 VALIDATION_ERROR for ?%s",
    async (query) => {
      const { auth } = await createLoggedInUser();
      const res = await request(app).get(`/api/dashboard/trend?${query}`).set("Authorization", auth);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.fields).toEqual([{ field: "range", message: "range must be 1M, 6M, 1Y or ALL." }]);
    }
  );

  it.each(["1M", "6M", "1Y", "ALL"])("returns no points for a user with no assets (%s)", async (range) => {
    const { auth } = await createLoggedInUser();
    const res = await getTrend(auth, range);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ range, currency: "INR", points: [] });
  });

  it("a new asset gives a single point for today", async () => {
    const { auth } = await createLoggedInUser();
    await createAsset(auth, { value: "1500.50" });
    expect((await getTrend(auth, "1Y")).body.points).toEqual([{ date: await istDay(), netWorth: "1500.50" }]);
  });

  it.each([
    ["1M", "1 month"],
    ["6M", "6 months"],
    ["1Y", "12 months"]
  ])("TC-Dash-03: %s covers the range with one point per day, oldest first", async (range, interval) => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth, { value: "100.00" });
    await backdateAsset(asset.id, "3 years");

    const { points } = (await getTrend(auth, range)).body;

    expect(points[0].date).toBe(await istDay(interval));
    expect(points.at(-1).date).toBe(await istDay());
    for (let i = 1; i < points.length; i++) {
      const gap = Date.parse(points[i].date) - Date.parse(points[i - 1].date);
      expect(gap).toBe(86_400_000);
    }
  });

  it("ALL starts when the portfolio starts, and a shorter range never starts before it", async () => {
    const { auth } = await createLoggedInUser();
    const old = await createAsset(auth, { value: "100.00" });
    await backdateAsset(old.id, "2 years");

    const all = (await getTrend(auth, "ALL")).body.points;
    expect(all.length).toBeGreaterThan(700);

    await backdateAsset(old.id, "10 days");
    const short = (await getTrend(auth, "1Y")).body.points;
    expect(short).toHaveLength(11);
  });

  it("the last point equals netWorth from /api/dashboard for every range, even after an unrecorded edit", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth, { assetType: "CASH", value: "100.00" });
    await createAsset(auth, { assetType: "GOLD", value: "250.25" });
    await backdateAsset(asset.id, "400 days");
    await addValuation(asset, "90.00", new Date(Date.now() - 200 * 86_400_000));
    // PUT /api/assets/:id changes the value without writing a valuation row.
    await request(app).put(`/api/assets/${asset.id}`).set("Authorization", auth).send({ value: 175.5 });

    const { netWorth } = (await getDashboard(auth)).body;
    expect(netWorth).toBe("425.75");

    for (const range of ["1M", "6M", "1Y", "ALL"]) {
      expect((await getTrend(auth, range)).body.points.at(-1)).toEqual({ date: await istDay(), netWorth });
    }
  });

  it("uses the latest valuation of each day and carries it forward over days without one", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth, { value: "500.00" });
    await backdateAsset(asset.id, "10 days");
    const fiveDaysAgo = await istDay("5 days");
    const twoDaysAgo = await istDay("2 days");
    await addValuation(asset, "100.00", `${fiveDaysAgo}T09:00:00+05:30`);
    await addValuation(asset, "200.00", `${fiveDaysAgo}T18:00:00+05:30`); // same day, later
    await addValuation(asset, "300.00", `${twoDaysAgo}T09:00:00+05:30`);

    const points = (await getTrend(auth, "1M")).body.points;
    const byDate = Object.fromEntries(points.map((p) => [p.date, p.netWorth]));

    expect(byDate[await istDay("6 days")]).toBe("100.00"); // before the first valuation: the first valuation
    expect(byDate[fiveDaysAgo]).toBe("200.00");
    expect(byDate[await istDay("4 days")]).toBe("200.00"); // carried forward
    expect(byDate[twoDaysAgo]).toBe("300.00");
    expect(byDate[await istDay("1 day")]).toBe("300.00");
    expect(byDate[await istDay()]).toBe("500.00"); // today: the current value
  });

  it("adds up several assets, each counted only from its own first day", async () => {
    const { auth } = await createLoggedInUser();
    const older = await createAsset(auth, { assetType: "CASH", value: "10.00" });
    const newer = await createAsset(auth, { assetType: "GOLD", value: "1.00" });
    await backdateAsset(older.id, "5 days");
    await backdateAsset(newer.id, "2 days");

    const byDate = Object.fromEntries((await getTrend(auth, "1M")).body.points.map((p) => [p.date, p.netWorth]));

    expect(byDate[await istDay("3 days")]).toBe("10.00");
    expect(byDate[await istDay("2 days")]).toBe("11.00");
    expect(byDate[await istDay()]).toBe("11.00");
  });

  it("includes valuation history older than the asset row", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth, { value: "10.00" });
    const start = await istDay("3 days");
    await addValuation(asset, "7.00", `${start}T12:00:00+05:30`);

    const { points } = (await getTrend(auth, "ALL")).body;

    expect(points[0]).toEqual({ date: start, netWorth: "7.00" });
    expect(points).toHaveLength(4);
  });

  it("assigns a valuation to its IST calendar day, not its UTC day", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth, { value: "999.00" });
    await backdateAsset(asset.id, "10 days");
    const day = await istDay("5 days");
    await addValuation(asset, "100.00", `${await istDay("8 days")}T12:00:00+05:30`);
    // 00:30 IST on `day` is 19:00 UTC on the previous date.
    await addValuation(asset, "200.00", `${day}T00:30:00+05:30`);

    const byDate = Object.fromEntries((await getTrend(auth, "1M")).body.points.map((p) => [p.date, p.netWorth]));

    expect(byDate[day]).toBe("200.00");
    expect(byDate[await istDay("6 days")]).toBe("100.00");
  });

  it("leaves soft-deleted assets out of every day", async () => {
    const { auth } = await createLoggedInUser();
    const kept = await createAsset(auth, { assetType: "CASH", value: "10.00" });
    const removed = await createAsset(auth, { assetType: "GOLD", value: "1000.00" });
    await backdateAsset(kept.id, "3 days");
    await backdateAsset(removed.id, "3 days");
    await addValuation(removed, "900.00", new Date(Date.now() - 2 * 86_400_000));
    await softDelete(auth, removed.id);

    const { points } = (await getTrend(auth, "1M")).body;

    expect(points).toHaveLength(4);
    expect(new Set(points.map((p) => p.netWorth))).toEqual(new Set(["10.00"]));
  });

  it("never includes another user's assets or valuations (PRJ-SR-004)", async () => {
    const alice = await createLoggedInUser("alice@example.com");
    const bob = await createLoggedInUser("bob@example.com");
    const bobs = await createAsset(bob.auth, { value: "5000.00" });
    await backdateAsset(bobs.id, "5 days");
    await addValuation(bobs, "4000.00", new Date(Date.now() - 3 * 86_400_000));

    expect((await getTrend(alice.auth, "ALL")).body.points).toEqual([]);

    await createAsset(alice.auth, { value: "1.00" });
    expect((await getTrend(alice.auth, "ALL")).body.points).toEqual([{ date: await istDay(), netWorth: "1.00" }]);
  });

  it("ignores legacy valuation rows that have no verified owner", async () => {
    const { auth } = await createLoggedInUser();
    await createAsset(auth, { value: "10.00" });
    await pool.query(
      `INSERT INTO valuations (asset_type, legacy_asset_id, value, source, valued_at)
       VALUES ('gold', 1, 777, 'MARKET', NOW() - INTERVAL '5 days')`
    );

    expect((await getTrend(auth, "ALL")).body.points).toEqual([{ date: await istDay(), netWorth: "10.00" }]);
  });

  it("includes a manual valuation made through the API", async () => {
    const { auth } = await createLoggedInUser();
    const asset = await createAsset(auth, { assetType: "REAL_ESTATE", value: "100.00" });
    await request(app).put(`/api/assets/${asset.id}/valuation`).set("Authorization", auth).send({ value: "150.00" });

    expect((await getTrend(auth, "1M")).body.points).toEqual([{ date: await istDay(), netWorth: "150.00" }]);
    expect((await getDashboard(auth)).body.netWorth).toBe("150.00");
  });
});

describe("GET /api/assets/dashboard-summary", () => {
  it("is kept for compatibility", async () => {
    const { auth } = await createLoggedInUser();
    await createAsset(auth, { assetType: "CASH", value: "10.00" });

    const res = await request(app).get("/api/assets/dashboard-summary").set("Authorization", auth);

    expect(res.status).toBe(200);
    expect(res.body.totalNetWorth).toBe(10);
  });
});
