-- B3 (#56): email addresses are case-insensitive.
-- The API now trims and lowercases every email it stores or looks up.
-- This migration brings existing rows in line and makes the database
-- itself refuse two accounts whose emails differ only in case or spaces.
--
-- Existing data is never deleted or merged automatically. If two accounts
-- already collide (for example "A@x.com" and "a@x.com"), the migration
-- stops with an error listing them and changes nothing; an administrator
-- must decide which account to keep, then run it again.

DO $$
DECLARE
    duplicates TEXT;
BEGIN
    SELECT string_agg(normalized || ' (user ids ' || ids || ')', '; ')
    INTO duplicates
    FROM (
        SELECT LOWER(TRIM(email)) AS normalized,
               string_agg(id::TEXT, ', ' ORDER BY id) AS ids
        FROM users
        GROUP BY LOWER(TRIM(email))
        HAVING COUNT(*) > 1
    ) AS collisions;

    IF duplicates IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot normalize user emails: these accounts differ only by case or spaces: %. Resolve them manually first.', duplicates;
    END IF;
END $$;

-- Safe now: no two rows map to the same normalized email.
UPDATE users
SET email = LOWER(TRIM(email)),
    updated_at = NOW()
WHERE email <> LOWER(TRIM(email));

-- Case-insensitive uniqueness, also used by the login lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
