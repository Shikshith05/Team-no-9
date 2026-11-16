-- Store the first successful market-refresh match for each price alert.
ALTER TABLE user_alerts
    ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS triggered_value NUMERIC(18, 2);
