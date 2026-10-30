-- Ensure users table has lockout columns (Story #31 & PRJ-SR-005)
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_until TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Ensure base assets table exists (Story #8, #9, #22)
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    asset_name VARCHAR(255) NOT NULL,
    asset_type VARCHAR(100) NOT NULL,
    value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    purchase_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Indexes (Story #26 & Story #22)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_assets_user_type ON assets(user_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_assets_user_created ON assets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_lockout ON users(email, lock_until);
