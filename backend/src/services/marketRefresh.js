
const pool = require("../config/db");

const REQUEST_TIMEOUT_MS = 8000;

const PURITY_FACTORS = {
  "18K": 0.75,
  "22K": 22 / 24,
  "24K": 1
};

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
    throw new Error(
      `Market provider returned HTTP ${response.status}`
    );
  }

  const data = await response.json();
  const price = Number(data.price ?? data.data?.price);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("Market provider returned an invalid price");
  }

  return price;
}

async function savePrice(client, assetType, assetId, price, provider) {
  await client.query(
    `INSERT INTO market_price_cache
      (asset_type, asset_id, price, currency, provider,
       fetched_at, is_stale, last_error)
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

async function runTransaction(work) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await work(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function refreshStockPrices() {
  try {
    const urlTemplate = getProviderUrl("STOCK_PRICE_API_URL");

    const result = await pool.query(
      "SELECT id, ticker_symbol, quantity FROM stock_assets"
    );

    const updates = [];
    const failed = [];

    // Fetch each stock independently.
    for (const stock of result.rows) {
      try {
        const url = urlTemplate.replace(
          "{symbol}",
          encodeURIComponent(stock.ticker_symbol)
        );

        const unitPrice = await fetchMarketPrice(
          url,
          process.env.STOCK_PRICE_API_KEY
        );

        const totalValue = Number(
          (unitPrice * Number(stock.quantity)).toFixed(2)
        );

        updates.push({
          id: stock.id,
          ticker: stock.ticker_symbol,
          unitPrice,
          totalValue
        });
      } catch (error) {
        // Mark the failed stock as stale.
        await pool.query(
          `UPDATE market_price_cache
           SET is_stale = TRUE,
               last_error = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE asset_type = 'stock'
             AND asset_id = $2`,
          [error.message, stock.id]
        );

        failed.push({
          assetId: stock.id,
          ticker: stock.ticker_symbol,
          error: error.message
        });

        console.error(
          `Stock refresh failed for ${stock.ticker_symbol}:`,
          error.message
        );
      }
    }

    // Save successful stock updates together.
    await runTransaction(async (client) => {
      for (const stock of updates) {
        // Cache stores price per share.
        await savePrice(
          client,
          "stock",
          stock.id,
          stock.unitPrice,
          "stock-api"
        );

        // History stores total holding value and unit price.
        await client.query(
          `INSERT INTO valuations
            (asset_type, asset_id, value, unit_price, source)
           VALUES ('stock', $1, $2, $3, 'MARKET')`,
          [stock.id, stock.totalValue, stock.unitPrice]
        );
      }
    });

    return {
      success: failed.length === 0,
      total: result.rows.length,
      refreshed: updates.length,
      failed
    };
  } catch (error) {
    // Handle global failures such as missing provider configuration.
    await markPricesStale("stock", error);
    throw error;
  }
}

async function refreshGoldPrices() {
  try {
    const url = getProviderUrl("GOLD_PRICE_API_URL");

    // Provider price is the base rate per gram.
    const pricePerGram = await fetchMarketPrice(
      url,
      process.env.GOLD_PRICE_API_KEY
    );

    const result = await pool.query(
      "SELECT id, weight_grams, purity FROM gold_assets"
    );

    const updates = result.rows.map((gold) => {
      const factor = PURITY_FACTORS[gold.purity];

      if (factor === undefined) {
        throw new Error(`Unsupported gold purity: ${gold.purity}`);
      }

      const totalValue = Number(
        (
          pricePerGram *
          Number(gold.weight_grams) *
          factor
        ).toFixed(2)
      );

      return {
        id: gold.id,
        totalValue
      };
    });

    await runTransaction(async (client) => {
      for (const gold of updates) {
        // Cache stores the rate per gram.
        await savePrice(
          client,
          "gold",
          gold.id,
          pricePerGram,
          "gold-api"
        );

        await client.query(
          `UPDATE gold_assets
           SET current_estimated_value = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [gold.totalValue, gold.id]
        );

        // History stores total value and base price per gram.
        await client.query(
          `INSERT INTO valuations
            (asset_type, asset_id, value, unit_price, source)
           VALUES ('gold', $1, $2, $3, 'MARKET')`,
          [gold.id, gold.totalValue, pricePerGram]
        );
      }
    });

    return {
      success: true,
      refreshed: updates.length
    };
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
