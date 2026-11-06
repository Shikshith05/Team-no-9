import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pool = require("../src/config/db");
import { refreshStockPrices } from "../src/services/marketRefresh";

describe("B8 - Stock market refresh", () => {
  let querySpy;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.STOCK_PRICE_API_URL =
      "https://example.com/price?symbol={symbol}";

    querySpy = vi.spyOn(pool, "query").mockImplementation(async (sql) => {
      if (sql.includes("SELECT id, ticker_symbol FROM stock_assets")) {
        return {
          rows: [
            { id: 1, ticker_symbol: "FAIL" },
            { id: 2, ticker_symbol: "SUCCESS" }
          ],
          rowCount: 2
        };
      }

      return { rows: [], rowCount: 1 };
    });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ price: 250 })
        })
    );
  })

  afterEach(() => {
    querySpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("continues refreshing after one ticker fails", async () => {
    const result = await refreshStockPrices();


    expect(result.total).toBe(2);
    expect(result.refreshed).toBe(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].ticker).toBe("FAIL");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});