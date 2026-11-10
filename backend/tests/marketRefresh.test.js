// B26 (PWM-F-020, PWM-F-021, PWM-F-023, PWM-F-024; SAD 4.5, 4.6; TC-Val-01,
// TC-Val-02, TC-Val-05) and B8 (#66): the market refresh revalues the users'
// holdings in `assets` and writes MARKET valuation rows. The price providers are
// replaced by a stubbed fetch (STP section 4: provider internals are not tested).
//
// B8's original test mocked pool.query around the old `stock_assets` table, which
// the refresh no longer reads; it now runs against the real test database, with
// the same assertions (total 2, refreshed 1, the failing ticker reported, both
// tickers fetched).
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app, pool, request, resetDatabase, createLoggedInUser, createAsset } from "./helpers";
import { refreshAllMarketPrices, refreshGoldPrices, refreshStockPrices } from "../src/services/marketRefresh";
import { runScheduledRefresh } from "../src/services/refreshScheduler";

const STOCK_URL = "https://stocks.test/price/{exchange}/{symbol}";
const GOLD_URL = "https://gold.test/rate";
const savedEnv = {};
const ENV_KEYS = ["STOCK_PRICE_API_URL", "GOLD_PRICE_API_URL", "STOCK_PRICE_API_KEY", "GOLD_PRICE_API_KEY"];

// prices: { "NSE/RELIANCE": 2900, ... , gold: 7200 }; a value of "fail" answers HTTP 500.
function stubProviders(prices) {
  const fetchMock = vi.fn(async (url) => {
    const key = url.startsWith("https://gold.test") ? "gold" : decodeURIComponent(url.split("/price/")[1]);
    const price = prices[key];
    if (price === undefined || price === "fail") return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ price }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const stock = (auth, ticker, quantity, extra = {}) =>
  createAsset(auth, { assetType: "STOCK", ticker, quantity, averageBuyPrice: "100.00", value: "1.00", ...extra });
const gold = (auth, purityKarat, weightGrams, extra = {}) =>
  createAsset(auth, { assetType: "GOLD", purityKarat, weightGrams, value: "1.00", ...extra });

async function valueOf(id) {
  return (await pool.query("SELECT value::TEXT AS value FROM assets WHERE id = $1", [id])).rows[0].value;
}

async function valuationsOf(id) {
  return (
    await pool.query(
      "SELECT asset_type, value::TEXT AS value, unit_price::TEXT AS unit_price, source FROM valuations WHERE asset_id = $1 ORDER BY id",
      [id]
    )
  ).rows;
}

async function cacheRow(key) {
  return (await pool.query("SELECT price::TEXT AS price, last_status, price_as_of FROM price_cache WHERE instrument_key = $1", [key]))
    .rows[0];
}

beforeEach(async () => {
  await resetDatabase();
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.STOCK_PRICE_API_URL = STOCK_URL;
  process.env.GOLD_PRICE_API_URL = GOLD_URL;
  delete process.env.STOCK_PRICE_API_KEY;
  delete process.env.GOLD_PRICE_API_KEY;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("B8 - Stock market refresh", () => {
  it("continues refreshing after one ticker fails", async () => {
    const { auth } = await createLoggedInUser();
    await stock(auth, "FAIL", "1");
    await stock(auth, "SUCCESS", "1");
    stubProviders({ "NSE/FAIL": "fail", "NSE/SUCCESS": 250 });

    const result = await refreshStockPrices();

    expect(result.total).toBe(2);
    expect(result.refreshed).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].ticker).toBe("FAIL");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("B26 - stock refresh revalues assets (PWM-F-020, TC-Val-01)", () => {
  it("sets each holding to quantity x new price and writes a MARKET valuation with the unit price", async () => {
    const alice = await createLoggedInUser("alice@example.com");
    const bob = await createLoggedInUser("bob@example.com");
    const a1 = await stock(alice.auth, "RELIANCE", "10");
    const a2 = await stock(alice.auth, "TCS", "3");
    const a3 = await stock(alice.auth, "INFY", "4", { exchange: "BSE" });
    const b1 = await stock(bob.auth, "RELIANCE", "2.5");
    const fetchMock = stubProviders({ "NSE/RELIANCE": 2900.5, "NSE/TCS": 4000, "BSE/INFY": 1500.25 });

    const result = await refreshStockPrices();

    expect(result).toMatchObject({ success: true, total: 3, refreshed: 3, assetsRevalued: 4, failed: [] });
    // SAD 4.6: one request per distinct symbol, however many holdings use it.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await valueOf(a1.id)).toBe("29005.00");
    expect(await valueOf(a2.id)).toBe("12000.00");
    expect(await valueOf(a3.id)).toBe("6001.00");
    expect(await valueOf(b1.id)).toBe("7251.25");

    expect(await valuationsOf(a1.id)).toEqual([{ asset_type: "STOCK", value: "29005.00", unit_price: "2900.50", source: "MARKET" }]);
    expect(await valuationsOf(b1.id)).toEqual([{ asset_type: "STOCK", value: "7251.25", unit_price: "2900.50", source: "MARKET" }]);
    expect(await cacheRow("STOCK:NSE:RELIANCE")).toMatchObject({ price: "2900.50", last_status: "OK" });
    expect(await cacheRow("STOCK:BSE:INFY")).toMatchObject({ price: "1500.25", last_status: "OK" });
  });

  it("uses decimal arithmetic, not floating point", async () => {
    const { auth } = await createLoggedInUser();
    const holding = await stock(auth, "RELIANCE", "3.5");
    // 2850.55 x 3.5 = 9976.925 exactly, which rounds to 9976.93. In floating point it is 9976.92499...
    stubProviders({ "NSE/RELIANCE": 2850.55 });

    await refreshStockPrices();

    expect(await valueOf(holding.id)).toBe("9976.93");
  });

  it("leaves soft-deleted holdings alone and does not fetch symbols only they hold", async () => {
    const { auth } = await createLoggedInUser();
    const kept = await stock(auth, "RELIANCE", "1");
    const removed = await stock(auth, "WIPRO", "1");
    await request(app).delete(`/api/assets/${removed.id}`).set("Authorization", auth);
    const fetchMock = stubProviders({ "NSE/RELIANCE": 100, "NSE/WIPRO": 500 });

    await refreshStockPrices();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await valueOf(kept.id)).toBe("100.00");
    expect(await valueOf(removed.id)).toBe("1.00");
    expect(await valuationsOf(removed.id)).toEqual([]);
  });

  it("one failed ticker keeps its last value and price, is flagged stale, and the next success clears it (PWM-F-024)", async () => {
    const holder = await createLoggedInUser("holder@example.com");
    const other = await createLoggedInUser("other@example.com");
    const tcs = await stock(holder.auth, "TCS", "2");
    const reliance = await stock(other.auth, "RELIANCE", "1");
    stubProviders({ "NSE/TCS": 4000, "NSE/RELIANCE": 2900 });
    await refreshStockPrices();
    const firstAsOf = (await cacheRow("STOCK:NSE:TCS")).price_as_of;

    stubProviders({ "NSE/TCS": "fail", "NSE/RELIANCE": 3000 });
    const result = await refreshStockPrices();

    expect(result).toMatchObject({ success: false, total: 2, refreshed: 1 });
    expect(result.failed).toEqual([{ ticker: "TCS", exchange: "NSE", error: "Market provider returned HTTP 500" }]);
    expect(await valueOf(tcs.id)).toBe("8000.00");
    expect(await valuationsOf(tcs.id)).toHaveLength(1);
    expect(await valueOf(reliance.id)).toBe("3000.00");
    expect(await valuationsOf(reliance.id)).toHaveLength(2);
    expect(await cacheRow("STOCK:NSE:TCS")).toMatchObject({ price: "4000.00", last_status: "FAILED", price_as_of: firstAsOf });

    const dashboard = (auth) => request(app).get("/api/dashboard").set("Authorization", auth);
    expect((await dashboard(holder.auth)).body.hasStaleData).toBe(true);
    expect((await dashboard(other.auth)).body.hasStaleData).toBe(false);

    stubProviders({ "NSE/TCS": 4100, "NSE/RELIANCE": 3000 });
    await refreshStockPrices();
    expect(await valueOf(tcs.id)).toBe("8200.00");
    expect((await dashboard(holder.auth)).body.hasStaleData).toBe(false);
  });

  it.each([[0], [-5], ["abc"], [null]])("treats a provider price of %s as a failure", async (price) => {
    const { auth } = await createLoggedInUser();
    const holding = await stock(auth, "RELIANCE", "1");
    stubProviders({ "NSE/RELIANCE": price });

    const result = await refreshStockPrices();

    expect(result.failed).toHaveLength(1);
    expect(await valueOf(holding.id)).toBe("1.00");
    expect(await valuationsOf(holding.id)).toEqual([]);
  });

  it("is visible through the API: asset list, valuation history and dashboard total", async () => {
    const { auth } = await createLoggedInUser();
    const holding = await stock(auth, "RELIANCE", "10");
    await createAsset(auth, { assetType: "CASH", value: "500.00" });
    stubProviders({ "NSE/RELIANCE": 2900 });

    await refreshStockPrices();

    const asset = await request(app).get(`/api/assets/${holding.id}`).set("Authorization", auth);
    expect(asset.body.currentValue).toBe("29000.00");

    const history = await request(app).get(`/api/valuations/history?assetId=${holding.id}`).set("Authorization", auth);
    expect(history.body.items).toEqual([
      expect.objectContaining({ assetId: holding.id, assetType: "STOCK", value: "29000.00", unitPrice: "2900.00", source: "MARKET" })
    ]);

    const dashboard = await request(app).get("/api/dashboard").set("Authorization", auth);
    expect(dashboard.body.netWorth).toBe("29500.00");
  });

  it("does nothing and fetches nothing when the stock feed is not configured", async () => {
    const { auth } = await createLoggedInUser();
    const holding = await stock(auth, "RELIANCE", "1");
    delete process.env.STOCK_PRICE_API_URL;
    const fetchMock = stubProviders({ "NSE/RELIANCE": 100 });

    await expect(refreshStockPrices()).rejects.toThrow("STOCK_PRICE_API_URL is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await valueOf(holding.id)).toBe("1.00");
  });

  it("refuses a plain-http feed (PRJ-SR-001)", async () => {
    process.env.STOCK_PRICE_API_URL = "http://stocks.test/price/{symbol}";
    const fetchMock = stubProviders({});

    await expect(refreshStockPrices()).rejects.toThrow("must use HTTPS");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("B26 - gold refresh revalues assets (PWM-F-021, TC-Val-02)", () => {
  it("values each purity from the 24K rate per gram: weight x rate24 x karat / 24", async () => {
    const alice = await createLoggedInUser("alice@example.com");
    const bob = await createLoggedInUser("bob@example.com");
    const coin22 = await gold(alice.auth, 22, "20.000");
    const bar24 = await gold(alice.auth, 24, "10.500");
    const ring18 = await gold(bob.auth, 18, "7.250");
    const fetchMock = stubProviders({ gold: 7200 });

    const result = await refreshGoldPrices();

    expect(result).toMatchObject({ success: true, total: 3, refreshed: 3, assetsRevalued: 3, failed: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await valueOf(coin22.id)).toBe("132000.00"); // 20 x 7200 x 22 / 24
    expect(await valueOf(bar24.id)).toBe("75600.00");
    expect(await valueOf(ring18.id)).toBe("39150.00"); // 7.25 x 7200 x 18 / 24
    expect(await valuationsOf(coin22.id)).toEqual([{ asset_type: "GOLD", value: "132000.00", unit_price: "6600.00", source: "MARKET" }]);
    expect(await cacheRow("GOLD:22K")).toMatchObject({ price: "6600.00", last_status: "OK" });
    expect(await cacheRow("GOLD:24K")).toMatchObject({ price: "7200.00", last_status: "OK" });
  });

  it("rounds the value from the exact rate, not from a rounded per-purity rate", async () => {
    const { auth } = await createLoggedInUser();
    const coin = await gold(auth, 22, "3.000");
    // 22K rate = 7201 x 22 / 24 = 6600.9166...; 3 g x that = 19802.75
    stubProviders({ gold: 7201 });

    await refreshGoldPrices();

    expect(await valueOf(coin.id)).toBe("19802.75");
    expect((await valuationsOf(coin.id))[0].unit_price).toBe("6600.92");
  });

  it("leaves soft-deleted gold alone and makes no request when nobody holds gold", async () => {
    const { auth } = await createLoggedInUser();
    const removed = await gold(auth, 22, "5.000");
    await request(app).delete(`/api/assets/${removed.id}`).set("Authorization", auth);
    const fetchMock = stubProviders({ gold: 7200 });

    const result = await refreshGoldPrices();

    expect(result).toMatchObject({ total: 0, refreshed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await valueOf(removed.id)).toBe("1.00");
  });

  it("on a feed failure keeps values and the last rate, and flags the purities as stale", async () => {
    const { auth } = await createLoggedInUser();
    const coin = await gold(auth, 22, "10.000");
    stubProviders({ gold: 7200 });
    await refreshGoldPrices();

    stubProviders({ gold: "fail" });
    await expect(refreshGoldPrices()).rejects.toThrow("HTTP 500");

    expect(await valueOf(coin.id)).toBe("66000.00");
    expect(await valuationsOf(coin.id)).toHaveLength(1);
    expect(await cacheRow("GOLD:22K")).toMatchObject({ price: "6600.00", last_status: "FAILED" });
    expect((await request(app).get("/api/dashboard").set("Authorization", auth)).body.hasStaleData).toBe(true);
  });
});

describe("B26 - refreshing everything and the scheduler", () => {
  it("refreshAllMarketPrices refreshes stocks and gold independently", async () => {
    const { auth } = await createLoggedInUser();
    const holding = await stock(auth, "RELIANCE", "2");
    const coin = await gold(auth, 24, "1.000");
    stubProviders({ "NSE/RELIANCE": 100, gold: "fail" });

    const { stocks, gold: goldResult } = await refreshAllMarketPrices();

    expect(stocks.status).toBe("fulfilled");
    expect(goldResult.status).toBe("rejected");
    expect(await valueOf(holding.id)).toBe("200.00");
    expect(await valueOf(coin.id)).toBe("1.00");
  });

  it("a scheduled run with no price feeds configured changes nothing and does not throw; the API keeps working", async () => {
    const { auth } = await createLoggedInUser();
    const holding = await stock(auth, "RELIANCE", "1");
    delete process.env.STOCK_PRICE_API_URL;
    delete process.env.GOLD_PRICE_API_URL;
    const fetchMock = stubProviders({});

    await expect(runScheduledRefresh()).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await valueOf(holding.id)).toBe("1.00");
    const res = await request(app).get("/api/dashboard").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.netWorth).toBe("1.00");
  });
});

describe("B26 - migration 012", () => {
  it("is safe to re-run on a database with data", async () => {
    const { auth } = await createLoggedInUser();
    await stock(auth, "RELIANCE", "1");
    stubProviders({ "NSE/RELIANCE": 100 });
    await refreshStockPrices();

    const sql = fs.readFileSync(path.resolve(__dirname, "../database/migrations/012_price_cache.sql"), "utf8");
    await pool.query(sql);
    await pool.query(sql);

    expect(await cacheRow("STOCK:NSE:RELIANCE")).toMatchObject({ price: "100.00", last_status: "OK" });
    // The old tables are kept.
    const tables = await pool.query(
      "SELECT COUNT(*)::INT AS n FROM pg_tables WHERE tablename IN ('market_price_cache', 'stock_assets', 'gold_assets')"
    );
    expect(tables.rows[0].n).toBe(3);
  });
});
