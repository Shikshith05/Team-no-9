
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { pool, resetDatabase } = require("./helpers");

const {
  refreshStockPrices,
  refreshGoldPrices
} = require("../src/services/marketRefresh");

beforeEach(async () => {
  await resetDatabase();

  process.env.STOCK_PRICE_API_URL =
    "https://stock.example.com/{symbol}";

  process.env.GOLD_PRICE_API_URL =
    "https://gold.example.com/price";

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ price: 100 })
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("B9 market price refresh", () => {
  it("stores stock per-share price and records total valuation", async () => {
    await pool.query(
      `INSERT INTO stock_assets
       (ticker_symbol, quantity, average_buy_price)
       VALUES ('TCS', 4, 80)`
    );

    await refreshStockPrices();

    const cache = await pool.query(
      "SELECT price FROM market_price_cache WHERE asset_type = 'stock'"
    );

    const history = await pool.query(
      "SELECT value, unit_price, source FROM valuations WHERE asset_type = 'stock'"
    );

    expect(cache.rows[0].price).toBe("100.00");
    expect(history.rows[0]).toMatchObject({
      value: "400.00",
      unit_price: "100.00",
      source: "MARKET"
    });
  });

  it("stores gold rate per gram and calculates 22K value", async () => {
    await pool.query(
      `INSERT INTO gold_assets
       (asset_name, gold_type, weight_grams, purity,
        purchase_value, purchase_date, current_estimated_value)
       VALUES ('Gold Chain', 'jewellery', 10, '22K',
               50000, CURRENT_DATE, 50000)`
    );

    await refreshGoldPrices();

    const cache = await pool.query(
      "SELECT price FROM market_price_cache WHERE asset_type = 'gold'"
    );

    const gold = await pool.query(
      "SELECT current_estimated_value FROM gold_assets"
    );

    const history = await pool.query(
      "SELECT value, unit_price, source FROM valuations WHERE asset_type = 'gold'"
    );

    expect(cache.rows[0].price).toBe("100.00");
    expect(gold.rows[0].current_estimated_value).toBe("916.67");

    expect(history.rows[0]).toMatchObject({
      value: "916.67",
      unit_price: "100.00",
      source: "MARKET"
    });
  });

  it("preserves cached stock price and creates no history on failure", async () => {
    await pool.query(
      `INSERT INTO stock_assets
       (ticker_symbol, quantity, average_buy_price)
       VALUES ('INFY', 2, 50)`
    );

    await pool.query(
      `INSERT INTO market_price_cache
       (asset_type, asset_id, price, fetched_at)
       VALUES ('stock', 1, 75, CURRENT_TIMESTAMP)`
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Provider unavailable"))
    );

    await expect(refreshStockPrices()).rejects.toThrow(
      "Provider unavailable"
    );

    const cache = await pool.query(
      "SELECT price, is_stale FROM market_price_cache WHERE asset_type = 'stock' AND asset_id = 1"
    );

    const history = await pool.query(
      "SELECT * FROM valuations WHERE asset_type = 'stock'"
    );

    expect(cache.rows[0].price).toBe("75.00");
    expect(cache.rows[0].is_stale).toBe(true);
    expect(history.rows).toHaveLength(0);
  });
});
