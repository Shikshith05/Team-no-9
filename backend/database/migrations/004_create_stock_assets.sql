CREATE TABLE IF NOT EXISTS stock_assets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticker_symbol VARCHAR(20) NOT NULL,
    quantity NUMERIC(15, 4) NOT NULL
        CHECK (quantity > 0),
    average_buy_price NUMERIC(15, 2) NOT NULL
        CHECK (average_buy_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT stock_assets_ticker_symbol_not_empty
        CHECK (LENGTH(TRIM(ticker_symbol)) > 0)
);