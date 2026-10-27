CREATE TABLE IF NOT EXISTS valuations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    asset_type VARCHAR(30) NOT NULL
        CHECK (
            asset_type IN (
                'real_estate',
                'gold',
                'cash_bank',
                'stock'
            )
        ),

    asset_id BIGINT NOT NULL,

    value NUMERIC(15, 2) NOT NULL
        CHECK (value >= 0),

    unit_price NUMERIC(15, 2)
        CHECK (unit_price IS NULL OR unit_price >= 0),

    source VARCHAR(20) NOT NULL
        CHECK (source IN ('MARKET', 'MANUAL')),

    valued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_valuations_asset_valued_at
    ON valuations (asset_id, valued_at DESC);