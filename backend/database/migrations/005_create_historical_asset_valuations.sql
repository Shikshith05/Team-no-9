CREATE TABLE IF NOT EXISTS historical_asset_valuations (
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

    valuation_date DATE NOT NULL,

    valuation_amount NUMERIC(15, 2) NOT NULL
        CHECK (valuation_amount >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT historical_asset_valuations_unique_snapshot
        UNIQUE (asset_type, asset_id, valuation_date)
);

CREATE INDEX IF NOT EXISTS idx_historical_asset_valuations_asset_date
    ON historical_asset_valuations (
        asset_type,
        asset_id,
        valuation_date
    );