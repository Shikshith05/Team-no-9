// Market refresh (PWM-F-020, PWM-F-021; SAD 4.5, 4.6; TC-Val-01, TC-Val-02).
//
// B26: the refresh revalues the users' holdings in the `assets` table. Before,
// it read the old per-type tables (stock_assets, gold_assets), which the app no
// longer writes, so stock and gold values never changed.
//
// For each instrument (one stock symbol, or one gold purity):
//   1. the price is fetched once, however many holdings use it (SAD 4.6);
//   2. in one transaction: price_cache is updated, every non-deleted holding's
//      assets.value is recalculated, and one MARKET row per holding is written to
//      valuations with the unit price (PWM-F-023);
//   3. if the fetch or the write fails, that instrument is marked FAILED in
//      price_cache (the stale flag, PWM-F-024) and keeps its last price and its
//      holdings keep their last value; the other instruments still refresh (B8).
//
// Values are worked out in PostgreSQL NUMERIC, not JavaScript floats (SAD 3.7):
//   stock: quantity x price per share
//   gold:  weight_grams x rate24 x purity_karat / 24 (SAD 4.5: the provider gives
//          the 24-karat rate per gram; other purities are derived from it)
// Both are rounded to 2 decimals.
//
// The scheduler (refreshScheduler.js) runs this for every user's holdings; no
// user request is involved, so there is no caller to scope by.
const pool = require("../config/db");

const REQUEST_TIMEOUT_MS = 8000;
const MAX_ERROR_LENGTH = 500;

function getProviderUrl(name) {
  const url = process.env[name];

  if (!url) {
    throw new Error(`${name} is not configured`);
  }

  if (new URL(url).protocol !== "https:") {
    throw new Error(`${name} must use HTTPS`);
  }

  return url;
}

// Returns the price as a decimal string, so it reaches PostgreSQL unchanged.
async function fetchMarketPrice(url, apiKey) {
  const headers = { Accept: "application/json" };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Market provider returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const price = Number(data?.price ?? data?.data?.price);

  // SAD 3.7: reject non-positive prices.
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Market provider returned an invalid price");
  }

  return String(price);
}

const stockKey = (exchange, ticker) => `STOCK:${exchange}:${ticker}`;
const goldKey = (karat) => `GOLD:${karat}K`;

async function inTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function savePrice(client, key, price, source) {
  await client.query(
    `INSERT INTO price_cache
       (instrument_key, price, price_as_of, last_attempt_at, last_status, last_error, source)
     VALUES ($1, $2, NOW(), NOW(), 'OK', NULL, $3)
     ON CONFLICT (instrument_key) DO UPDATE SET
       price = EXCLUDED.price,
       price_as_of = EXCLUDED.price_as_of,
       last_attempt_at = EXCLUDED.last_attempt_at,
       last_status = 'OK',
       last_error = NULL,
       source = EXCLUDED.source`,
    [key, price, source]
  );
}

// The last successful price stays; only the status changes.
async function markFailed(key, error) {
  try {
    await pool.query(
      `INSERT INTO price_cache (instrument_key, last_attempt_at, last_status, last_error)
       VALUES ($1, NOW(), 'FAILED', $2)
       ON CONFLICT (instrument_key) DO UPDATE SET
         last_attempt_at = NOW(),
         last_status = 'FAILED',
         last_error = EXCLUDED.last_error`,
      [key, String(error.message).slice(0, MAX_ERROR_LENGTH)]
    );
  } catch (cacheError) {
    console.error(`Could not mark ${key} as stale:`, cacheError.message);
  }
}

async function markAllFailed(prefix, error) {
  try {
    await pool.query(
      `UPDATE price_cache
       SET last_attempt_at = NOW(), last_status = 'FAILED', last_error = $2
       WHERE instrument_key LIKE $1`,
      [`${prefix}%`, String(error.message).slice(0, MAX_ERROR_LENGTH)]
    );
  } catch (cacheError) {
    console.error(`Could not mark ${prefix} prices as stale:`, cacheError.message);
  }
}

// PWM-F-020 / TC-Val-01: quantity x latest price for each held symbol.
async function refreshStockPrices() {
  let urlTemplate;
  try {
    urlTemplate = getProviderUrl("STOCK_PRICE_API_URL");
  } catch (error) {
    await markAllFailed("STOCK:", error);
    throw error;
  }

  // Holdings saved before B22 may have no ticker or quantity; they cannot be valued.
  const instruments = await pool.query(
    `SELECT DISTINCT COALESCE(exchange, 'NSE') AS exchange, ticker
     FROM assets
     WHERE asset_type = 'STOCK'
       AND deleted_at IS NULL
       AND ticker IS NOT NULL
       AND quantity IS NOT NULL
     ORDER BY 1, 2`
  );

  let refreshed = 0;
  let assetsRevalued = 0;
  const failed = [];

  for (const { exchange, ticker } of instruments.rows) {
    const key = stockKey(exchange, ticker);

    try {
      const url = urlTemplate
        .replace("{symbol}", encodeURIComponent(ticker))
        .replace("{exchange}", encodeURIComponent(exchange));
      const price = await fetchMarketPrice(url, process.env.STOCK_PRICE_API_KEY);

      const written = await inTransaction(async (client) => {
        await savePrice(client, key, price, "stock-api");

        const result = await client.query(
          `WITH unit AS (SELECT ROUND($1::NUMERIC, 2) AS price),
           revalued AS (
             UPDATE assets
             SET value = ROUND(unit.price * assets.quantity, 2),
                 updated_at = NOW()
             FROM unit
             WHERE assets.asset_type = 'STOCK'
               AND assets.deleted_at IS NULL
               AND assets.ticker = $2
               AND COALESCE(assets.exchange, 'NSE') = $3
               AND assets.quantity IS NOT NULL
             RETURNING assets.id, assets.value
           )
           INSERT INTO valuations (asset_type, asset_id, value, unit_price, source, valued_at)
           SELECT 'STOCK', revalued.id, revalued.value, unit.price, 'MARKET', NOW()
           FROM revalued CROSS JOIN unit`,
          [price, ticker, exchange]
        );
        return result.rowCount;
      });

      refreshed++;
      assetsRevalued += written;
    } catch (error) {
      await markFailed(key, error);
      failed.push({ ticker, exchange, error: error.message });
      console.error(`Stock refresh failed for ${exchange}:${ticker}:`, error.message);
      // B8: carry on with the next symbol.
    }
  }

  return {
    success: failed.length === 0,
    total: instruments.rowCount,
    refreshed,
    assetsRevalued,
    failed
  };
}

// PWM-F-021 / TC-Val-02: weight x rate for the purity.
async function refreshGoldPrices() {
  let url;
  try {
    url = getProviderUrl("GOLD_PRICE_API_URL");
  } catch (error) {
    await markAllFailed("GOLD:", error);
    throw error;
  }

  const purities = await pool.query(
    `SELECT DISTINCT purity_karat::INT AS karat
     FROM assets
     WHERE asset_type = 'GOLD'
       AND deleted_at IS NULL
       AND purity_karat IS NOT NULL
       AND weight_grams IS NOT NULL
     ORDER BY 1`
  );

  if (purities.rowCount === 0) {
    return { success: true, total: 0, refreshed: 0, assetsRevalued: 0, failed: [] };
  }

  let rate24;
  try {
    // One request per cycle: the 24-karat rate per gram.
    rate24 = await fetchMarketPrice(url, process.env.GOLD_PRICE_API_KEY);
  } catch (error) {
    for (const { karat } of purities.rows) await markFailed(goldKey(karat), error);
    console.error("Gold refresh failed:", error.message);
    throw error;
  }

  let refreshed = 0;
  let assetsRevalued = 0;
  const failed = [];

  for (const { karat } of purities.rows) {
    const key = goldKey(karat);

    try {
      const written = await inTransaction(async (client) => {
        const rate = await client.query(
          "SELECT ROUND($1::NUMERIC * $2::INT / 24, 2)::TEXT AS rate",
          [rate24, karat]
        );
        await savePrice(client, key, rate.rows[0].rate, "gold-api");

        const result = await client.query(
          `WITH revalued AS (
             UPDATE assets
             SET value = ROUND(weight_grams * $1::NUMERIC * purity_karat / 24, 2),
                 updated_at = NOW()
             WHERE asset_type = 'GOLD'
               AND deleted_at IS NULL
               AND purity_karat = $2
               AND weight_grams IS NOT NULL
             RETURNING id, value
           )
           INSERT INTO valuations (asset_type, asset_id, value, unit_price, source, valued_at)
           SELECT 'GOLD', id, value, $3::NUMERIC, 'MARKET', NOW()
           FROM revalued`,
          [rate24, karat, rate.rows[0].rate]
        );
        return result.rowCount;
      });

      refreshed++;
      assetsRevalued += written;
    } catch (error) {
      await markFailed(key, error);
      failed.push({ purity: `${karat}K`, error: error.message });
      console.error(`Gold refresh failed for ${karat}K:`, error.message);
    }
  }

  return {
    success: failed.length === 0,
    total: purities.rowCount,
    refreshed,
    assetsRevalued,
    failed
  };
}

async function refreshAllMarketPrices() {
  const results = await Promise.allSettled([
    refreshStockPrices(),
    refreshGoldPrices()
  ]);

  return {
    stocks: results[0],
    gold: results[1]
  };
}

module.exports = {
  refreshStockPrices,
  refreshGoldPrices,
  refreshAllMarketPrices
};
