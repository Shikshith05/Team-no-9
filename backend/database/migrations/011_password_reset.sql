-- B24: forgot / reset password (PWM-F-003, AC-PWM-F-003, TC-Auth-03; SAD 3.9,
-- 4.2.3, 4.4; PRJ-SR-003, TC-Sec-03).
--
-- password_reset_tokens follows SAD 4.4: only the SHA-256 hash of a token is
-- stored, never the token itself; tokens expire after 30 minutes and work once.
-- users.token_valid_after (SAD 3.9): a password reset sets it, and the auth
-- middleware rejects every token issued before it, on every device.
--
-- Safe on a database with data, and safe to re-run.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
    ON password_reset_tokens (user_id, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_valid_after TIMESTAMPTZ;
