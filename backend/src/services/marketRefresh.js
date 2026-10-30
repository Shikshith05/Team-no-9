
const pool = require("../config/db");

const REQUEST_TIMEOUT_MS = 8000;

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
  const price = Number(data.price ?? data.data?.price);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Market provider returned an invalid price");
  }

  return price;
}

async function savePrice(assetType, assetId, price, provider) {
  await pool.query(
    `INSERT INTO market_price_cache
      (asset_type, asset_id, price, currency, provider, fetched_at, is_stale, last_error)
     VALUES ($1, $2, $3, 'INR', $4, CURRENT_TIMESTAMP, FALSE, NULL)
     ON CONFLICT (asset_type, asset_id)
     DO UPDATE SET
       price = EXCLUDED.price,
       currency = EXCLUDED.currency,
       provider = EXCLUDED.provider,
       fetched_at = EXCLUDED.fetched_at,
       is_stale = FALSE,
       last_error = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [assetType, assetId, price, provider]
  );
}

async function markPricesStale(assetType, error) {
  await pool.query(
    `UPDATE market_price_cache
     SET is_stale = TRUE,
         last_error = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE asset_type = $1`,
    [assetType, error.message]
  );
}

async function refreshStockPrices() {
  try {
    const urlTemplate = getProviderUrl("STOCK_PRICE_API_URL");

    const result = await pool.query(
      "SELECT id, ticker_symbol FROM stock_assets"
    );

    for (const stock of result.rows) {
      try {
        const url = urlTemplate.replace(
          "{symbol}",
          encodeURIComponent(stock.ticker_symbol)
        );

        const price = await fetchMarketPrice(
          url,
          process.env.STOCK_PRICE_API_KEY
        );

        await savePrice(
          "stock",
          stock.id,
          price,
          "stock-api"
        );
      } catch (error) {
        await markPricesStale("stock", error);
        throw error;
      }
    }

    return { success: true, refreshed: result.rowCount };
  } catch (error) {
    await markPricesStale("stock", error);
    throw error;
  }
}

async function refreshGoldPrices() {
  try {
    const url = getProviderUrl("GOLD_PRICE_API_URL");

    const pricePerGram = await fetchMarketPrice(
      url,
      process.env.GOLD_PRICE_API_KEY
    );

    const result = await pool.query(
      "SELECT id, weight_grams, purity FROM gold_assets"
    );

    const purityFactors = {
      "18K": 0.75,
      "22K": 22 / 24,
      "24K": 1
    };

    for (const gold of result.rows) {
      const factor = purityFactors[gold.purity];

      if (!factor) {
        throw new Error(`Unsupported gold purity: ${gold.purity}`);
      }

      const value = Number(
        (pricePerGram * Number(gold.weight_grams) * factor).toFixed(2)
      );

      await savePrice("gold", gold.id, value, "gold-api");

      await pool.query(
        `UPDATE gold_assets
         SET current_estimated_value = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [value, gold.id]
      );
    }

    return { success: true, refreshed: result.rowCount };
  } catch (error) {
    await markPricesStale("gold", error);
    throw error;
  }
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
