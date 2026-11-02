BEGIN;

-- Preserve every existing per-type asset ID.
-- Old IDs cannot safely be mapped to assets(id), because the
-- legacy asset tables had independent ID sequences.
ALTER TABLE valuations
    ADD COLUMN IF NOT EXISTS legacy_asset_id BIGINT;

-- Move legacy IDs only if the new foreign key has not already
-- been installed. This prevents a rerun from moving new records.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_valuations_asset_id_assets'
          AND conrelid = 'valuations'::regclass
    ) THEN
        UPDATE valuations
        SET legacy_asset_id = asset_id,
            asset_id = NULL
        WHERE asset_id IS NOT NULL
          AND legacy_asset_id IS NULL;
    END IF;
END $$;

-- Legacy records have no verified unified asset reference.
ALTER TABLE valuations
    ALTER COLUMN asset_id DROP NOT NULL;

-- The unified assets table supports more asset types than the
-- old per-type valuation schema.
ALTER TABLE valuations
    ALTER COLUMN asset_type TYPE VARCHAR(100);

ALTER TABLE valuations
    DROP CONSTRAINT IF EXISTS valuations_asset_type_check;

-- New records reference assets(id).
-- Asset deletion cascades to valuation rows; normal asset deletion
-- in this application is soft deletion, so history remains available.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_valuations_asset_id_assets'
          AND conrelid = 'valuations'::regclass
    ) THEN
        ALTER TABLE valuations
            ADD CONSTRAINT fk_valuations_asset_id_assets
            FOREIGN KEY (asset_id)
            REFERENCES assets(id)
            ON DELETE CASCADE;
    END IF;

    -- Every valuation must reference exactly one kind of asset ID:
    -- either the new unified ID or the preserved legacy ID.
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_valuations_exactly_one_asset_reference'
          AND conrelid = 'valuations'::regclass
    ) THEN
        ALTER TABLE valuations
            ADD CONSTRAINT ck_valuations_exactly_one_asset_reference
            CHECK (
                (asset_id IS NOT NULL AND legacy_asset_id IS NULL)
                OR
                (asset_id IS NULL AND legacy_asset_id IS NOT NULL)
            );
    END IF;
END $$;

-- Index for looking up preserved legacy records.
CREATE INDEX IF NOT EXISTS idx_valuations_legacy_asset_id
    ON valuations (legacy_asset_id);

COMMIT;