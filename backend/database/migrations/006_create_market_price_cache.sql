CREATE TABLE IF NOT EXISTS market_price_cache (
    asset_type VARCHAR(20) NOT NULL
        CHECK (asset_type IN ('stock', 'gold')),

    asset_id BIGINT NOT NULL,

    price NUMERIC(15, 2) NOT NULL
        CHECK (price >= 0),

    currency VARCHAR(3) NOT NULL DEFAULT 'INR',

    provider VARCHAR(100),

    fetched_at TIMESTAMPTZ NOT NULL,

    is_stale BOOLEAN NOT NULL DEFAULT FALSE,

    last_error TEXT,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (asset_type, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_market_price_cache_stale
    ON market_price_cache (is_stale, fetched_at);
