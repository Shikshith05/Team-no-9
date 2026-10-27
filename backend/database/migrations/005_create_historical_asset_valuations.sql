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

    valuation_amount NUMERIC(15, 2) NOT NULL
        CHECK (valuation_amount >= 0),

    valued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_valuations_asset_valued_at
    ON valuations (asset_id, valued_at DESC);