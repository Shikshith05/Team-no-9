-- B22: the fields each asset class needs (PWM-F-010 to PWM-F-013, PWM-F-015;
-- SAD 4.3.3, 4.4; TC-RE-01, TC-Gold-01, TC-Stock-01, TC-Cash-01, TC-Asset-02).
--
-- Team decision: keep the single `assets` table. The per-type detail tables of
-- SAD 4.4 are replaced by nullable columns here; the API (assetController.js,
-- utils/assetValidation.js) decides which ones each type requires. The legacy
-- per-type tables (real_estate_assets, gold_assets, ...) and the valuations
-- foreign key are not touched.
--
-- Safe on a database that already has assets, and safe to re-run:
--   * columns are added with IF NOT EXISTS and are nullable, so existing rows
--     stay valid without guessed values;
--   * constraints are added only when missing;
--   * the type mapping only touches rows that are not canonical yet.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS location VARCHAR(255);              -- REAL_ESTATE
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_value NUMERIC(18, 2);      -- REAL_ESTATE
ALTER TABLE assets ADD COLUMN IF NOT EXISTS form VARCHAR(10);                   -- GOLD
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purity_karat SMALLINT;              -- GOLD
ALTER TABLE assets ADD COLUMN IF NOT EXISTS weight_grams NUMERIC(12, 3);        -- GOLD
ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(18, 2);      -- GOLD
ALTER TABLE assets ADD COLUMN IF NOT EXISTS ticker VARCHAR(20);                 -- STOCK
ALTER TABLE assets ADD COLUMN IF NOT EXISTS exchange VARCHAR(10);               -- STOCK
ALTER TABLE assets ADD COLUMN IF NOT EXISTS quantity NUMERIC(18, 4);            -- STOCK
ALTER TABLE assets ADD COLUMN IF NOT EXISTS average_buy_price NUMERIC(18, 2);   -- STOCK
ALTER TABLE assets ADD COLUMN IF NOT EXISTS account_label VARCHAR(150);         -- CASH
-- The asset_type a row had before this migration, when it was not canonical.
ALTER TABLE assets ADD COLUMN IF NOT EXISTS legacy_asset_type VARCHAR(100);

-- Existing asset types. Rows were written with free text ("real_estate",
-- "Stock", "cash_bank", ...). Spellings that clearly mean one of the four SRS
-- classes are mapped to the SAD name; the original text is kept in
-- legacy_asset_type, so nothing is lost. Anything else (for example "banana")
-- is left exactly as it is: we cannot tell which class it belongs to, and
-- guessing would move money between classes on the dashboard. Such rows stay
-- visible and counted; the API asks for a valid type the next time one is edited.
UPDATE assets
SET legacy_asset_type = asset_type,
    asset_type = CASE
        WHEN UPPER(REGEXP_REPLACE(TRIM(asset_type), '[\s/-]+', '_', 'g'))
             IN ('REAL_ESTATE', 'REALESTATE', 'PROPERTY') THEN 'REAL_ESTATE'
        WHEN UPPER(TRIM(asset_type)) IN ('GOLD') THEN 'GOLD'
        WHEN UPPER(TRIM(asset_type)) IN ('STOCK', 'STOCKS', 'EQUITY', 'SHARES') THEN 'STOCK'
        WHEN UPPER(REGEXP_REPLACE(TRIM(asset_type), '[\s/&-]+', '_', 'g'))
             IN ('CASH', 'CASH_BANK', 'BANK', 'CASH_AND_BANK') THEN 'CASH'
    END
WHERE asset_type NOT IN ('REAL_ESTATE', 'GOLD', 'STOCK', 'CASH')
  AND legacy_asset_type IS NULL
  AND (
        UPPER(REGEXP_REPLACE(TRIM(asset_type), '[\s/-]+', '_', 'g')) IN ('REAL_ESTATE', 'REALESTATE', 'PROPERTY')
     OR UPPER(TRIM(asset_type)) IN ('GOLD', 'STOCK', 'STOCKS', 'EQUITY', 'SHARES')
     OR UPPER(REGEXP_REPLACE(TRIM(asset_type), '[\s/&-]+', '_', 'g')) IN ('CASH', 'CASH_BANK', 'BANK', 'CASH_AND_BANK')
  );

-- Unmapped rows record their own type as the legacy value (unchanged), which is
-- what lets them pass the type check below.
UPDATE assets
SET legacy_asset_type = asset_type
WHERE asset_type NOT IN ('REAL_ESTATE', 'GOLD', 'STOCK', 'CASH')
  AND legacy_asset_type IS NULL;

DO $$
BEGIN
    -- A new or edited row must use one of the four SRS classes. A legacy row
    -- may keep exactly the unknown type it already had, and nothing else.
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_assets_asset_type' AND conrelid = 'assets'::regclass) THEN
        ALTER TABLE assets ADD CONSTRAINT ck_assets_asset_type CHECK (
            asset_type IN ('REAL_ESTATE', 'GOLD', 'STOCK', 'CASH')
            OR asset_type = COALESCE(legacy_asset_type, '')
        );
    END IF;

    -- PWM-F-015 / TC-Asset-02: the database blocks bad values even when the API
    -- is bypassed. NULL passes (the column does not apply to that type).
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_assets_purchase_value' AND conrelid = 'assets'::regclass) THEN
        ALTER TABLE assets ADD CONSTRAINT ck_assets_purchase_value CHECK (purchase_value >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_assets_gold_form' AND conrelid = 'assets'::regclass) THEN
        ALTER TABLE assets ADD CONSTRAINT ck_assets_gold_form CHECK (form IN ('JEWELLERY', 'COIN', 'BAR'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_assets_purity_karat' AND conrelid = 'assets'::regclass) THEN
        ALTER TABLE assets ADD CONSTRAINT ck_assets_purity_karat CHECK (purity_karat BETWEEN 1 AND 24);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_assets_weight_grams' AND conrelid = 'assets'::regclass) THEN
        ALTER TABLE assets ADD CONSTRAINT ck_assets_weight_grams CHECK (weight_grams > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_assets_purchase_price' AND conrelid = 'assets'::regclass) THEN
        ALTER TABLE assets ADD CONSTRAINT ck_assets_purchase_price CHECK (purchase_price >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_assets_exchange' AND conrelid = 'assets'::regclass) THEN
        ALTER TABLE assets ADD CONSTRAINT ck_assets_exchange CHECK (exchange IN ('NSE', 'BSE'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_assets_quantity' AND conrelid = 'assets'::regclass) THEN
        ALTER TABLE assets ADD CONSTRAINT ck_assets_quantity CHECK (quantity > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_assets_average_buy_price' AND conrelid = 'assets'::regclass) THEN
        ALTER TABLE assets ADD CONSTRAINT ck_assets_average_buy_price CHECK (average_buy_price >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_assets_value_non_negative' AND conrelid = 'assets'::regclass) THEN
        -- NOT VALID: older rows were never checked, and a negative one must not
        -- stop the migration. New and edited rows are checked.
        ALTER TABLE assets ADD CONSTRAINT ck_assets_value_non_negative CHECK (value >= 0) NOT VALID;
    END IF;
END $$;
