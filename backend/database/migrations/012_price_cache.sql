-- B26: price cache for the market refresh (PWM-F-020, PWM-F-021, PWM-F-024;
-- SAD 4.4 price_cache, 4.5, 4.6; TC-Val-01, TC-Val-02, TC-Val-05).
--
-- One row per instrument, not per holding, so each symbol (or gold purity) is
-- fetched once per cycle however many users hold it (SAD 4.6, 3.10):
--   STOCK:<exchange>:<ticker>   price per share
--   GOLD:<karat>K               rate per gram for that purity
-- price is the last successful price and stays when a later refresh fails;
-- last_status = 'FAILED' is the stale flag (SAD 4.5).
--
-- The old market_price_cache table (migration 006) and the per-type asset tables
-- are kept as they are; nothing writes to them any more.
--
-- Safe on a database with data, and safe to re-run.

CREATE TABLE IF NOT EXISTS price_cache (
    instrument_key VARCHAR(64) PRIMARY KEY,
    price NUMERIC(18, 2) CHECK (price > 0),       -- NULL until the first success
    price_as_of TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_status VARCHAR(10) NOT NULL CHECK (last_status IN ('OK', 'FAILED')),
    last_error TEXT,
    source VARCHAR(50)
);

-- The refresh selects market-valued holdings by type.
CREATE INDEX IF NOT EXISTS idx_assets_market_holdings
    ON assets (asset_type)
    WHERE deleted_at IS NULL AND asset_type IN ('STOCK', 'GOLD');
