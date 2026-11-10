# Sprint 3 Bug Log

Bug bash for the Personal Wealth Management app. Tracking issue: [#52](https://github.com/Shikshith05/Team-no-9/issues/52).
Integration branch: `fix/bug-bash`. Each bug has its own issue, owner and fix branch, and every fix needs a test (#52).

Owners: Shikshith: B1, B2, B3, B4, B5, B6, B11, B14, B15, B16–B21, bug log; Greeshma: B7, B7b, B13; Rushikesh: B8, B9, B10, B12. B1, B2, B11 and B15 were first assigned to Sateesh in #52.

Status as of 2026-11-10 (last updated 2026-11-10).

## Summary

| Bug | Issue | Title | Assignee | Status |
|---|---|---|---|---|
| B1 | [#59](https://github.com/Shikshith05/Team-no-9/issues/59) | Connect login page to /api/auth/login | Shikshith05 | Fixed – merged into `fix/bug-bash` via PRs #74, #79 |
| B2 | [#60](https://github.com/Shikshith05/Team-no-9/issues/60) | Resolve frontend and backend authentication mismatch | Shikshith05 | Fixed – merged into `fix/bug-bash` via PRs #74, #79 |
| B3 | [#56](https://github.com/Shikshith05/Team-no-9/issues/56) | Normalize email addresses to prevent case-sensitive duplicate accounts | Shikshith05 | Fixed – PR #70 (on `main`) |
| B4 | [#57](https://github.com/Shikshith05/Team-no-9/issues/57) | Add email format and password strength validation during registration | Shikshith05 | Fixed – PR #70 (on `main`) |
| B5 | [#54](https://github.com/Shikshith05/Team-no-9/issues/54) | Implement missing asset APIs | Shikshith05 | Fixed – PR #70 (on `main`); manual valuation-history write implemented by B7 PR #73 |
| B6 | [#55](https://github.com/Shikshith05/Team-no-9/issues/55) | Standardize API error responses and prevent database error leakage | Shikshith05 | Fixed – PR #70 (on `main`) |
| B7 | [#63](https://github.com/Shikshith05/Team-no-9/issues/63) | Fix valuation asset relationship and implement valuation history API | GREESHMA-K77 | Fixed – merged into `fix/bug-bash` via PR #73 |
| B7b | [#64](https://github.com/Shikshith05/Team-no-9/issues/64) | Restore secure valuation history in CSV and PDF exports | GREESHMA-K77 | Fixed – merged into `fix/bug-bash` via PR #77 |
| B8 | [#66](https://github.com/Shikshith05/Team-no-9/issues/66) | Prevent one failed ticker from stopping the entire stock refresh | Rushikesh9742 | Fixed – merged into `fix/bug-bash` via PR #72 |
| B9 | [#67](https://github.com/Shikshith05/Team-no-9/issues/67) | Correct market-price cache semantics and persist valuation history during refresh | Rushikesh9742 | Superseded by B26 (PR #76 not merged) |
| B10 | [#68](https://github.com/Shikshith05/Team-no-9/issues/68) | Remove obsolete frontend valuation worker and duplicate root-level services | Rushikesh9742 | Fixed – merged into `fix/bug-bash` via PR #71 |
| B11 | [#61](https://github.com/Shikshith05/Team-no-9/issues/61) | Fix dashboard endpoint mismatch between frontend and backend | Shikshith05 | Fixed – merged into `fix/bug-bash` via PR #80 |
| B12 | [#69](https://github.com/Shikshith05/Team-no-9/issues/69) | Persist dashboard alerts per user using backend storage | Rushikesh9742 | Fixed – merged into `fix/bug-bash` via PR #74 |
| B13 | [#65](https://github.com/Shikshith05/Team-no-9/issues/65) | Standardize date formatting in CSV and PDF exports | GREESHMA-K77 | Fixed – merged into `fix/bug-bash` via PR #78 |
| B14 | [#51](https://github.com/Shikshith05/Team-no-9/issues/51) (duplicate: [#53](https://github.com/Shikshith05/Team-no-9/issues/53)) | Backend has no tests and CI only runs a syntax check | Shikshith05 | Fixed – PR #70 (on `main`) |
| B15 | [#62](https://github.com/Shikshith05/Team-no-9/issues/62) | Fix missing Dockerfiles, Nginx configuration and certificate references | Shikshith05 | Fixed – merged into `fix/bug-bash` via PR #82 |
| B16 | none (audit) | Lockout re-locks after it expires | Shikshith05 | Fixed – merged into `fix/bug-bash` via PR #81 |
| B17 | none (audit) | JWT lifetime hard-coded to 1h | Shikshith05 | Fixed – merged into `fix/bug-bash` via PR #81 |
| B18 | none (audit) | No security headers, X-Powered-By exposed | Shikshith05 | Fixed – merged into `fix/bug-bash` via PR #81 |
| B19 | none (audit) | `.env.example` missing JWT and CORS settings | Shikshith05 | Fixed – merged into `fix/bug-bash` via PR #81 |
| B20 | none (audit) | README has no run instructions | Shikshith05 | Fixed – merged into `fix/bug-bash` via PR #81 |
| B21 | none (audit) | Logging in right after logout gives a revoked token | Shikshith05 | Fixed – merged into `fix/bug-bash` via PR #81 |
| B22 | none (audit) | Asset types lack their required fields; any asset type accepted | Shikshith05 | Fixed – merged into `fix/bug-bash` via PR #83 |
| B23 | none (audit) | No way to add, edit or delete assets in the UI | Shikshith05 | Fixed – merged into `fix/bug-bash` via PR #84 |
| B24 | none (audit) | Forgot / reset password endpoints don't exist | Shikshith05 | Fixed – merged into `fix/bug-bash` via PR #85 |
| B25 | none | No rate limiting on `/api/auth/*` (SAD 3.9) | Sateesh5298 | Open – changes requested, not in this release. PR #86 |
| B26 | none (B9, #67) | Market refresh never revalues stock and gold in `assets` | Shikshith05 | Fixed – branch `fix/B26-market-revalue-assets`, PR into `fix/bug-bash` (supersedes PR #76) |

Release status (`fix/bug-bash` → `main`):
- Everything above marked "Fixed" is in `fix/bug-bash` and was checked by the final regression on 2026-11-10 (below).
- B9 (#67, PR #76) and B25 (PR #86) are **not** in this release. They are listed under "Known limitations in this release".
- B16–B25 came from the audit and have no GitHub issues. They are tracked here and in their PRs.

## Details

### B1 – Login page not connected (#59) – Fixed in PR #79
- **Steps to reproduce (before):** open `#/login`, enter any email and password, press Log in. The page shows "Logging in isn't connected yet" and no request is sent.
- **Root cause:** `frontend/src/pages/LoginPage.jsx` was still the Sprint 2 placeholder; its submit handler never called `POST /api/auth/login`.
- **Fix:** connected in PR #74. PR #79 finishes it: login and register show the backend's messages (401 invalid credentials, 423 locked with the retry time, 400 and 409 on the field they concern).
- **Tests:** `frontend/src/pages/authPages.test.jsx`, `frontend/src/api/auth.test.js`, and the real-backend journey `frontend/e2e-real/journey.spec.js`.

### B2 – Frontend and backend authentication mismatch (#60) – Fixed in PR #79
- **Steps to reproduce (before):** log in through the API, then open Reports and export. Asset screens send a cookie (`credentials: 'include'` in `frontend/src/api/http.js`); the backend only reads `Authorization: Bearer` (`authMiddleware.js`); `ReportsPage.jsx` reads a `token` from `localStorage` that no login flow ever writes.
- **Root cause:** no agreed authentication method; each side implemented a different one.
- **Fix:** the team chose a Bearer token in `localStorage` under the single key `token`, a deviation from SAD 4.3.1 recorded in `docs/auth-decision.md`. `frontend/src/api/session.js` is now the only code touching the stored session. `http.js` sends the token on every call, including exports, and any 401 clears the session and goes to `#/login`.
- **Tests:** `frontend/src/api/http.test.js`, `frontend/src/pages/authPages.test.jsx`, `frontend/e2e-real/journey.spec.js`.

### B3 – Case-sensitive duplicate accounts (#56) – Fixed
- **Steps to reproduce (before):** register `User@Example.com`, then register `user@example.com`. Both succeed and create two accounts; logging in as `USER@example.com` fails.
- **Root cause:** `authController.js` stored and compared the email exactly as typed; the unique index on `users.email` is case-sensitive.
- **Fix:** register and login trim and lowercase the email and look it up with `LOWER(email)`. Migration `008_case_insensitive_user_email.sql` lowercases existing rows and adds a unique index on `LOWER(email)`; if accounts already collide it stops with an error listing them and changes nothing (no automatic deletes or merges). A registration race hitting the index gets "already registered".
- **Tests:** `backend/tests/emailNormalization.test.js` (mixed case and whitespace duplicates rejected, login with any casing, lockout counted on one account, database-level uniqueness, migration on legacy data).

### B4 – No registration validation (#57) – Fixed
- **Steps to reproduce (before):** `POST /api/auth/register` with `{"name":"a","email":"not-an-email","password":"1"}` returns 201.
- **Root cause:** register only checked that the fields were present.
- **Fix:** `backend/src/utils/validation.js` applies the SAD policy: valid email (max 254), password 10–128 characters with at least one letter and one digit and not on a common-password list, name required. All field errors are returned at once as 400 `VALIDATION_ERROR`; nothing is written. Rules and messages match `frontend/src/lib/validation.js`.
- **Tests:** `backend/tests/registrationValidation.test.js` (every rule, the 10/128 boundaries, valid registration, bcrypt hash stored).

### B5 – Missing asset APIs (#54) – Fixed
- **Steps to reproduce (before):** with a valid token, `GET /api/assets`, `GET /api/assets/1` and `PUT /api/assets/1/valuation` return Express's HTML 404. The Assets, valuation and history screens can only run on mock data.
- **Root cause:** only create, update, delete and dashboard-summary were implemented.
- **Fix:** list (type filter, page/limit, `{items,page,limit,total}`), get-one and manual valuation on the `assets` table, all scoped to the caller and to non-deleted rows, in the shapes of `frontend/src/api/assets.js`. Stock and gold are refused with 422 `MARKET_VALUED`. Another user's asset is 404.
- **Valuation history:** Manual valuation updates now write a MANUAL row to `valuations` in the same transaction (implemented in B7 PR #73). `location` and `purchaseValue` were null because the unified table had no such columns; B22 adds them.
- **Tests:** `backend/tests/assetEndpoints.test.js`.

### B6 – Inconsistent errors and database error leakage (#55) – Fixed
- **Steps to reproduce (before):** `POST /api/assets` with `"purchaseDate":"not-a-date"` returns 400 with PostgreSQL's raw message; most errors are `{"success":false,"message":...}` instead of the SAD shape; a database outage during the token check is reported as "Invalid or expired token".
- **Root cause:** each controller built its own error body and sent `error.message` to the client.
- **Fix:** `backend/src/utils/errors.js` (AppError, central `errorHandler`, JSON 404 for unknown `/api` routes). Every error is `{"error":{"code","message","fields"}}`, which `frontend/src/api/http.js` reads. Codes: VALIDATION_ERROR 400, UNAUTHORIZED 401, ACCOUNT_LOCKED 423, NOT_FOUND 404, CONFLICT 409, MARKET_VALUED 422, INTERNAL_ERROR 500 (generic message; details only in the server log). Asset input is validated with field errors. Wrong password and unknown email now return identical 401 bodies (the old `remainingAttempts` field revealed which emails exist).
- **Tests:** `backend/tests/errorFormat.test.js`, plus the shape checks in the other suites.

### B7 – Valuation rows point at the wrong asset table (#63) – Fixed
- **Steps to reproduce (before):** `valuations.asset_id` (migration 005) is a plain BIGINT matched against the per-type tables, which each have their own ID sequence. Real estate asset 1 and gold asset 1 share `asset_id = 1`, and none of these tables has a `user_id`, so a valuation cannot be tied to its owner.
- **Root cause:** valuations were designed before the unified `assets` table existed.
- **Fix / tests:** Merged via PR #73: migration 009, ownership-scoped history API, transactional manual valuation recording, pagination and regression tests.

### B7b – Valuation history removed from exports (#64) – Fixed
- **Steps to reproduce (before):** export CSV or PDF. Only current assets are listed; the PDF says valuation history is "temporarily omitted".
- **Root cause:** history was removed on purpose to stop the cross-user leak described in B7.
- **Fix / tests:** Merged via PR #77. Exports include valuation history again, limited to the caller's non-deleted assets; covered in `backend/tests/reports.test.js`.

### B8 – One failed ticker stops the whole stock refresh (#66) – Fixed
- **Steps to reproduce (before):** run the stock refresh with one failing ticker. The job stops and every stock is marked stale.
- **Root cause:** the refresh handled a failure for the whole run, not for each ticker.
- **Fix / tests:** Merged via PR #72. Each ticker is handled separately and only the failing one is marked stale; covered in `backend/tests/marketRefresh.test.js`.

### B9 – Market-price cache semantics and valuation history during refresh (#67) – Open, PR #76, not in this release
- **Steps to reproduce:** compare `market_price_cache.price` for a stock and a gold holding: one is a per-share price, the other a total holding value. After a successful refresh, `valuations` has no new rows.
- **Root cause:** the two asset classes use one column with different meanings, and the refresh job never writes valuation history.
- **Fix / tests:** in PR #76 (Rushikesh), which is not part of the Sprint 3 release. Until it lands, the `value` of stock and gold assets is what the user entered and is not revalued automatically from the price feeds.

### B10 – Obsolete frontend valuation worker and duplicate services (#68) – Fixed
- **Steps to reproduce (before):** `frontend/src/valuationWorker.js` calls `example.com`, and `alertService.js` and `valuationWorker.js` are duplicated at the repository root.
- **Root cause:** code left over from before the backend refresh service existed.
- **Fix / tests:** Merged via PR #71. The unused worker and duplicates were removed; the frontend build and tests pass.


### B11 – Dashboard endpoint mismatch (#61) – Fixed in PR #80
- **Steps to reproduce (before):** the frontend calls `GET /api/dashboard` and `GET /api/dashboard/trend`; the backend only has `GET /api/assets/dashboard-summary`, so both return 404. After PR #74 the page also shows only price alerts, with no totals or charts.
- **Root cause:** frontend and backend were built against different contracts, and #74 replaced `Dashboard.jsx`.
- **Fix:** both endpoints added, scoped to the caller's non-deleted assets. Allocation percents total exactly 100.00 (SAD 4.5). The trend is worked out from `valuations` per IST day, with no snapshots table, and today's point always equals `netWorth`. The dashboard cards are restored and the alerts moved to `AlertsPanel`.
- **Tests:** `backend/tests/dashboard.test.js`, `frontend/src/pages/Dashboard.test.jsx`, `frontend/e2e-real/dashboard.spec.js`.

### B12 – Dashboard alerts not persisted per user (#69) – Fixed
- **Steps to reproduce (before):** add an alert and reload the page. It is gone, and alerts used the hard-coded user `user_01`.
- **Root cause:** alerts lived in browser memory only.
- **Fix / tests:** Merged via PR #74. Alerts are stored in `user_alerts` per authenticated user (migration 009); covered in `backend/tests/alerts.test.js`.

### B13 – Export date formats (#65) – Fixed in PR #78
- **Steps to reproduce:** risk of JavaScript default date strings (`Fri Oct 30 2026 ...`) in CSV/PDF.
- **Root cause / current state:** `reportController.js` on `main` already formats `purchase_date` as `YYYY-MM-DD` and `created_at` as ISO 8601 UTC in SQL, as the issue's own note says. What remains is verifying it and adding the timezone tests the issue asks for.
- **Fix / tests:** Existing SQL date formatting retained. Added CSV and PDF timezone regression tests in `backend/tests/reports.test.js`, verifying date-only purchase dates and ISO 8601 UTC timestamps at a timezone boundary. Full backend suite on `fix/bug-bash` at the final regression (2026-11-10): 206 tests passed.

### B14 – No backend tests, CI only checks syntax (#51, duplicate #53) – Fixed
- **Steps to reproduce (before):** `cd backend && npm test` exits 1 ("no test specified"); `.github/workflows/main.yml` only runs `node --check` for the backend and never runs the frontend's Vitest suite.
- **Root cause:** no test setup existed.
- **Fix:** Vitest + Supertest; a helper that drops and recreates the test database (`POSTGRES_DB` must end in `_test`), applies the migrations in filename order (stripping the BOM in 007) and truncates all tables before each test; JWT_SECRET is generated per run. CI gets a `postgres:16` service and runs `npm test` in both the backend and frontend jobs, also for `fix/bug-bash`.
- **Tests:** baseline suites `auth`, `assets`, `reports` (18 tests), then each fix added its own.

### New findings during regression (no issue yet)
- **Asset create/update return the purchase date shifted by a day.** `POST /api/assets` with `"purchaseDate":"2021-03-15"` answers `"purchase_date":"2021-03-14T18:30:00.000Z"`: node-pg turns a DATE into midnight in the server's time zone (IST), which is the previous day in UTC. The stored value is correct, and the new `GET /api/assets` endpoints return `2021-03-15`. Fix: format the date in SQL (as the report and list queries do) or set a pg type parser for DATE. Needs an issue and an owner.
- **Backend dependency advisory (resolved in PR #81).** `npm audit fix` moved `body-parser` to 2.4.0, so `npm audit --omit=dev` now reports 0 vulnerabilities. `npm audit` still reports 2 moderate advisories in dev dependencies only (`nodemon` through `minimatch`). The offered fix needs `--force` and is flagged as breaking, so it was not applied.

### B15 – Missing Docker and Nginx files (#62) – Fixed in PR #82
- **Steps to reproduce (before):** `docker compose build`. `docker-compose.yml` builds `frontend/Dockerfile` and `backend/Dockerfile` and mounts `./nginx.conf` and `./certs`; none of these exist in the repository.
- **Root cause:** compose file was added without the files it references.
- **Fix:** added `backend/Dockerfile`, `frontend/Dockerfile`, `nginx.conf`, `scripts/gen-dev-certs.sh`, a `postgres:16-alpine` service with a named volume, `GET /api/health`, and a rewritten `docker-compose.yml` in which only the gateway publishes ports. Testing found that PostgreSQL restarting crashed the API process, because the `pg` pool had no `error` listener; `config/db.js` now has one.
- **Tests:** `backend/tests/health.test.js`, `backend/tests/migrate.test.js`, and a manual run through the gateway, listed in PR #82.

### B16 – Lockout re-locks after it expires – Fixed in PR #81
- **Requirement:** PRJ-SR-005, TC-Sec-05.
- **Steps to reproduce (before):** enter 5 wrong passwords and wait 15 minutes, then enter one wrong password. The account locks for another 15 minutes and the next attempt gets 423.
- **Root cause:** `failed_login_attempts` stayed at 5 after `lock_until` passed. The next failure counted as the 6th, which met the limit again.
- **Fix:** a failure after an expired lock starts a new count at 1. Lockouts and blocked attempts now go to the server log with only the user id and times. SAD 3.9 also asks for an `audit_log` table, which does not exist yet.
- **Tests:** `backend/tests/authHardening.test.js`: 5 wrong then 423; after expiry 1 wrong is 401 and the right password is 200; 5 more are needed to lock again; a wrong password while locked does not extend the lock; no secrets in the log.

### B17 – JWT lifetime hard-coded to 1h – Fixed in PR #81
- **Requirement:** PRJ-SR-003 (configurable, default 24h).
- **Steps to reproduce (before):** log in and decode the token: `exp - iat` is 3600 whatever the configuration.
- **Root cause:** `expiresIn: "1h"` in `authController.js`.
- **Fix:** `JWT_EXPIRES_IN`, default `24h`. A plain number means seconds; `jsonwebtoken` would otherwise read it as milliseconds.
- **Tests:** `backend/tests/authHardening.test.js`: the default, a custom value, a plain number, an expired token, and a bad value giving a generic 500.

### B18 – No security headers, X-Powered-By exposed – Fixed in PR #81
- **Requirement:** TC-Sec-06, SAD 3.9.
- **Steps to reproduce (before):** `curl -I http://localhost:5000/health` shows `X-Powered-By: Express` and no security headers.
- **Root cause:** nothing set them.
- **Fix:** `app.disable('x-powered-by')` and `helmet`.
- **Tests:** `backend/tests/authHardening.test.js`, on public, protected and unknown routes.

### B19 – `.env.example` missing JWT and CORS settings – Fixed in PR #81
- **Steps to reproduce (before):** copy `.env.example` to `.env` and start the backend. It exits with `JWT_SECRET must be set before starting the API`.
- **Root cause:** `JWT_SECRET`, `JWT_EXPIRES_IN` and `FRONTEND_ORIGIN` were not in the file.
- **Fix:** added them with no real secrets, and blanked the placeholder price-feed URLs so the scheduler does not call `api.example.com`. The placeholder secret works for local development, but with `NODE_ENV=production` the API refuses to start with it or with any secret under 32 characters.
- **Tests:** `jwtSecretProblem` in `backend/tests/authHardening.test.js`.

### B20 – README has no run instructions – Fixed in PR #81
- **Steps to reproduce (before):** read `README.md`: one line.
- **Root cause:** never written.
- **Fix:** local setup (role and database, `.env`, migration loops for bash and PowerShell, backend and frontend), tests, Docker, configuration and troubleshooting.
- **Tests:** documentation. The role, database and bash loop were run against PostgreSQL 16; the Docker steps, including the PowerShell certificate command, were run for B15. The PowerShell `psql` loop was not run, because `psql` is not installed on the test machine; only its file order was checked.

### B21 – Logging in right after logout gives a revoked token – Fixed in PR #81
- **Requirement:** PRJ-SR-003, SAD 3.9 (claims include `jti`).
- **Steps to reproduce (before):** log in, log out, and log in again within the same second. The login succeeds, but every request then answers 401. Found by `frontend/e2e-real/journey.spec.js`.
- **Root cause:** tokens held only `id`, `email`, `iat` and `exp`, so two logins in the same second produced the identical JWT, and logout had just blacklisted it.
- **Fix:** each token gets a random `jti`.
- **Tests:** `backend/tests/authHardening.test.js`.

### B24 – Forgot / reset password endpoints don't exist – Fixed in PR #85
- **Requirement:** PWM-F-003 (AC-PWM-F-003: the link expires after 30 minutes and works once; TC-Auth-03); PRJ-SR-003 (TC-Sec-03); PRJ-SR-005; SAD 3.9, 4.2.3, 4.3.4, 4.4.
- **Steps to reproduce (before):** open `#/forgot-password`, enter an email and press "Send reset link". `POST /api/auth/forgot-password` answers 404 and the page shows "We couldn't send the request". `POST /api/auth/reset-password` also answers 404.
- **Expected:** the same reply for any email; a single-use link valid for 30 minutes; after a reset, the new password works, old sessions end and any lockout is cleared.
- **Root cause:** only the frontend pages and a mock were built (Sprint 2). The endpoints, the token table and session invalidation were never implemented.
- **Fix:**
  - Migration `011_password_reset.sql` adds `password_reset_tokens` (SAD 4.4: `user_id`, SHA-256 `token_hash`, `expires_at`, `used_at`) and `users.token_valid_after` (SAD 3.9).
  - `POST /api/auth/forgot-password {email}`: a bad email format is 400. Otherwise the reply is always 202 with the same body, whether or not the account exists (SAD 4.3.4). For an existing account it makes a random 32-byte token, stores only its hash with a 30-minute expiry, and removes the user's older unused tokens.
  - `POST /api/auth/reset-password {token, password}`: an unknown, expired or used token is 400 `RESET_TOKEN_INVALID`, `RESET_TOKEN_EXPIRED` or `RESET_TOKEN_USED` in the SAD error format.
  - The password must meet the registration policy (400 `VALIDATION_ERROR` on `password`). A weak password does not use up the link.
  - On success the password is hashed with bcrypt, the token is marked used, `failed_login_attempts` and `lock_until` are cleared, and `token_valid_after` is set.
  - `authMiddleware.js` rejects any JWT issued before `token_valid_after` with 401 "Your password was changed".
  - The time is cut to whole seconds, because a JWT's `iat` is: a login in the same second as the reset must keep working (compare B21). The cost is that a token issued earlier in that same second is not rejected.
  - Frontend: `api/auth.js` sends `{token, password}` (it sent `newPassword`) and clears this browser's session after a reset. `ResetPasswordPage.jsx` reads the `password` field error. Both pages already had their screens.
- **Deviations:**
  - **No email.** There is no email service or notification outbox (SAD 4.1, 4.6). Outside production the reset link is written to the backend console. That breaks SAD 3.9's "reset links are never logged", but it is the only way to use the feature locally. In production nothing secret is logged, so reset links cannot be delivered until an email provider is added. Documented in README.md.
  - The reply is 202 (SAD 4.3.4), not 200.
  - No rate limit on `/api/auth/*` yet (SAD 3.9 asks for one).
  - No `audit_log` table: events go to the server log, with the user id only.
  - An existing email does slightly more database work than an unknown one, so response timing is not perfectly uniform.
- **Tests:**
  - `backend/tests/passwordReset.test.js`: identical reply for an unknown email; only the hash is stored, with a 30-minute expiry; link logged outside production and not in production; a new request invalidates the old link; new password works and the old one doesn't; single use; expired link; unknown, missing or malformed token; weak passwords leave the link usable; old JWTs rejected; lockout cleared; other users unaffected; migration 011 re-run on existing data.
  - `frontend/src/pages/passwordResetPages.test.jsx`: request body, the three link-problem screens, server password error, client policy, local session cleared.
  - `frontend/e2e-real/passwordReset.spec.js`: the full journey against the real backend, reading the link from the backend log (`E2E_BACKEND_LOG`).

### B22 – Asset types lack their required fields – Fixed in PR #83
- **Requirement:** PWM-F-010, PWM-F-011, PWM-F-012, PWM-F-013, PWM-F-015; SAD 4.3.3, 4.4; TC-RE-01, TC-Gold-01, TC-Stock-01, TC-Cash-01, TC-Asset-02.
- **Steps to reproduce (before):** `POST /api/assets` with `{"assetName":"x","assetType":"banana","value":1}` returns 201. A gold asset cannot carry its form, purity or weight, a stock its ticker or quantity, a property its location or purchase value, or a cash entry its account label: `assets` only has name, type, value and purchase date, and `GET /api/assets` always answers `location: null` and `purchaseValue: null`.
- **Expected:** each asset class stores the fields its SRS requirement lists, invalid input is rejected with field-level messages (400), and only the four SRS classes exist.
- **Root cause:** the unified `assets` table (migration 007) replaced the per-type tables of migrations 001–004 without taking their columns, and `assetType` was validated only as non-empty text.
- **Fix:**
  - Migration `010_asset_type_fields.sql` adds nullable columns to `assets` (team decision: one table): `location`, `purchase_value` (real estate); `form`, `purity_karat`, `weight_grams`, `purchase_price` (gold); `ticker`, `exchange`, `quantity`, `average_buy_price` (stock); `account_label` (cash), with the SAD 4.4 column types and CHECK constraints (no negative money, weight and quantity above 0, purity 1–24, form JEWELLERY/COIN/BAR, exchange NSE/BSE, `value` at least 0 for new and edited rows). The per-type tables and the valuations foreign key are unchanged.
  - **Existing rows:** spellings that clearly mean one class (`real_estate`, `Real Estate`, `gold`, `Stock`, `cash_bank`, …) are mapped to the SAD names `REAL_ESTATE`, `GOLD`, `STOCK`, `CASH`, and the original text is kept in `legacy_asset_type`. Anything else (for example `banana`) is left exactly as it is, still listed and counted, because guessing its class would move money between dashboard slices. A CHECK constraint allows only the four types, or a legacy row's own original value. No row, value or valuation is deleted. The migration is safe to re-run.
  - `backend/src/utils/assetValidation.js`: `assetType` must be one of the four (any case). Required per type: real estate: name, location, purchase value, purchase date, value; gold: form, purity, weight, purchase price, value; stock: ticker, quantity, average buy price, value (exchange optional, default NSE); cash: account label, value. Gold, stock and cash get a name from their details if none is given. Decimals may be strings (SAD 4.3.1) or numbers, with 2 decimals for money, 3 for weight and 4 for quantity. Max lengths: name and location 255, account label 150, ticker 20. All field errors are returned together as 400 `VALIDATION_ERROR`. Fields belonging to another type are ignored.
  - `PUT /api/assets/:id` merges the body over the stored asset and validates the result, so partial updates still work. Changing the type clears the old type's fields. An asset stored before B22 must be completed on its first edit. Ownership and soft-delete rules are unchanged (another user's or a deleted asset is 404).
  - `GET /api/assets` and `GET /api/assets/:id` return the new fields (null where they don't apply). The `POST`/`PUT` response shape `{success, data}` is unchanged. Dashboard and exports use only the existing columns and work as before. For legacy rows the export now shows `REAL_ESTATE` instead of `real_estate`, because the stored type was normalized.
  - `value` is still the value the user enters for every type. Revaluing stock and gold from the price feeds (PWM-F-020/021) belongs to B9, PR #76.
- **Deviations:**
  - SRS AC-PWM-F-012 and TC-Stock-01 ask for the ticker to be checked against known symbols (422 when unknown). There is no symbol master (SAD `instruments` table), so only the format is checked.
  - SRS PWM-F-015 says "non-negative": money may be 0, but weight and quantity must be above 0, as in the legacy tables.
  - Request field names stay `assetName` and `value` (existing API) rather than SAD 4.3.3's `currentEstimatedValue` and `balance`.
  - Asset edits do not write a valuations row (SAD 4.5). Only `PUT /api/assets/:id/valuation` does, because a change here would alter the exports that B13 (PR #78) is testing.
  - Another user's asset is 404, not the 403 of PRJ-SR-004 (unchanged from B5).
- **Tests:** `backend/tests/assetTypes.test.js` (valid create per type, missing and invalid fields per type including purity 0/25, negative weight and bad tickers, unknown types rejected, database CHECKs when the API is bypassed, partial update, type change, cross-user read and update, soft-deleted asset, legacy row completion, dashboard and CSV) and `backend/tests/assetTypesMigration.test.js` (010 applied by the runner to a database with free-text assets and a valuation row, then re-run twice). `tests/helpers.js` fills valid per-type details, so suites that only set name, type and value (including `reports.test.js`) are unchanged. Real-backend Playwright specs updated to send the new fields.

### B23 – No way to add, edit or delete assets in the UI – Fixed in PR #84
- **Requirement:** PWM-F-014 (TC-Asset-01), PWM-F-010 to PWM-F-013, PWM-F-015; SRS 3.1 (inline validation); SAD 4.8; PWM-NF-004 (TC-UX-01).
- **Steps to reproduce (before):** log in and open Assets. Only real estate is listed. There is no button to add an asset, and no way to edit or delete one. Gold, stocks and cash can only be created with a direct API call.
- **Expected:** an "Add asset" form for each of the four classes, plus edit and delete for every asset; the dashboard totals follow (AC-PWM-F-014).
- **Root cause:** `AssetsPage.jsx` was built for the manual real-estate valuation story (#12) only. The forms waited for the asset APIs, and then for the per-type fields (B22).
- **Fix:**
  - `AssetsPage.jsx` lists every asset by class (real estate, stocks, gold, cash, then any pre-B22 row with another type). Each card shows its class's details.
  - "Add asset" opens `components/AssetForm.jsx`. Its fields change with the type selected (B22's fields).
  - `lib/assetForm.js` applies the API's rules in the browser, so an error shows next to its input and nothing is sent. Server field errors (SAD format) appear on the same inputs.
  - The submit button is disabled and reads "Saving…" while the request runs.
  - Edit opens the same form prefilled and sends `PUT /api/assets/:id`.
  - Delete opens `components/ConfirmDialog.jsx`, an in-page `alertdialog` (not `window.confirm`): focus starts on Cancel and stays in the dialog, Escape cancels, and server errors show inside it. Confirming sends `DELETE /api/assets/:id`, a soft delete.
  - After every change, `notifyAssetsChanged()` reloads the list and the dashboard.
  - All calls go through `http.js`, so a 401 clears the session and goes to the login page.
- **Tests:**
  - `frontend/src/lib/assetForm.test.js` and `frontend/src/pages/AssetsPage.test.jsx`: fields per type; client errors with nothing sent; create, edit and delete call the right endpoints with the right bodies; server field errors; 401; delete dialog confirm, cancel, Escape and error; the list reloads.
  - `frontend/e2e/assets.spec.js` (mock data): add, edit and delete with net worth following, plus the form for every type and the dialog at 360, 768 and 1280 px.
  - `frontend/e2e-real/assets.spec.js` (real backend): log in, add each type through the form, edit, delete; the dashboard total changes each time.
  - `docs/responsive-test-log.md` updated.

### B25 – No rate limiting on `/api/auth/*` – Open, PR #86, not in this release
- **Requirement:** SAD 3.9 (rate limiting on the authentication endpoints).
- **Steps to reproduce:** send many `POST /api/auth/login` (or `forgot-password`) requests in a row. None is throttled; only the per-account lockout (PRJ-SR-005) applies.
- **Owner / fix:** Sateesh5298, PR #86. Changes were requested in review, so it is not part of the Sprint 3 release.

### B26 – Market refresh never revalues stock and gold in `assets` (B9, #67) – Fixed, supersedes PR #76
- **Requirement:** PWM-F-020 and PWM-F-021 (High; TC-Val-01, TC-Val-02), PWM-F-023 (High), PWM-F-024 (Medium, stale flag only); SAD 4.4 `price_cache`, 4.5, 4.6.
- **Steps to reproduce (before):** add a stock (RELIANCE, 10 shares, value 28000) and 22K gold (20 g, value 120000). Start the backend with both price feed URLs set. The refresh logs success, but `GET /api/assets` still shows 28000 and 120000, `GET /api/valuations/history` has no MARKET rows, and the dashboard total does not change. `PUT /api/assets/:id/valuation` refuses stock and gold (422 MARKET_VALUED), so only editing the asset can change their value.
- **Root cause:** `services/marketRefresh.js` read the old per-type tables (`stock_assets`, `gold_assets`) from migrations 002 and 004. The app has written to the unified `assets` table since migration 007, so the refresh found no holdings, or revalued rows nothing reads. It never wrote to `valuations`. PR #76 still used the old tables and would put their ids into `valuations.asset_id`, which has referenced `assets(id)` since migration 009.
- **Fix:**
  - Migration `012_price_cache.sql` adds the SAD 4.4 `price_cache` table, with one row per instrument: `STOCK:<exchange>:<ticker>` (price per share) or `GOLD:<karat>K` (rate per gram). It stores the last good price, `price_as_of`, `last_status` (OK/FAILED) and `last_error`. The migration is re-runnable. `market_price_cache` and the per-type tables are kept, but nothing writes to them any more.
  - The refresh reads the non-deleted STOCK and GOLD holdings in `assets` (all users; it runs in the scheduler, not for a request). It fetches each distinct symbol once, and the gold rate once (SAD 4.6).
  - For each instrument, one transaction updates `price_cache`, sets `assets.value` and writes one `valuations` row per holding with the real `asset_id`, `unit_price` and source `MARKET`.
  - Stock value = quantity × price. Gold value = weight × rate24 × karat / 24 (SAD 4.5: the feed gives the 24K rate per gram). Both are calculated in PostgreSQL NUMERIC and rounded to 2 decimals.
  - If one instrument fails (HTTP error, timeout, a price of 0 or below, or a database error), its holdings keep their value and the cache keeps its last price. Its row is marked FAILED and the other instruments still refresh (B8).
  - `GET /api/dashboard` sets `hasStaleData` when one of the caller's own holdings uses a FAILED price. The old class-level check on `market_price_cache` is kept for rows left from before.
  - The scheduler still starts only when both feed URLs are set (https only), so without them the app works as before. The default interval is now once a day (PWM-F-020), not 60 seconds, because every run now writes one history row per holding. `.env.example` is updated to match.
  - The gold and stock form hints no longer say "Market revaluation is not automatic yet".
  - Reused from PR #76: the cache holds the per-unit price, the valuation row carries `unit_price`, and writes are transactional.
- **Not done (outside this bug):** retries with backoff and `isStale`/`priceAsOf` on each asset (PWM-F-024, Medium), trading-day calendar, manual refresh endpoint, admin refresh.
- **Tests:** `backend/tests/marketRefresh.test.js`, with the providers stubbed:
  - quantity × price for several users, exchanges and a shared symbol, with one fetch per symbol;
  - NUMERIC rounding;
  - soft-deleted holdings untouched;
  - one failed ticker keeps its value and last price, is flagged stale for its holder only, and the next success clears the flag;
  - invalid prices; values visible through the asset, history and dashboard APIs;
  - feed not configured, and plain-http feed refused;
  - gold 18K, 22K and 24K from the 24K rate, with exact-rate rounding;
  - gold feed failure; stocks and gold refreshed independently;
  - a scheduler run with no feeds changes nothing and the API keeps working;
  - migration 012 re-run on existing data.

  B8's original test mocked queries on `stock_assets`. It now runs against the real database with the same assertions. Frontend: `src/lib/assetForm.test.js` checks the hint text. Also checked by hand: the backend with a local HTTPS stub feed revalued RELIANCE to 29,005.00 and 22K gold to 132,000.00, wrote MARKET history and updated the dashboard total, and a failing ticker was flagged only for its holder.

## Regression testing

### Final regression – 2026-11-10 (B26)

Run on `fix/B26-market-revalue-assets` at `5c076bd` (`fix/bug-bash` at `adf990a` plus B26). Windows 11, Node 22.19.0, PostgreSQL 16 (Docker).

| Suite | Before (`adf990a`) | After |
|---|---|---|
| Backend API (`npm test`, throwaway `postgres:16`, database `*_test`) | 206 passed | **224 passed** in 17 files, 13 migrations |
| Frontend unit (`npm test`) | 110 passed | **111 passed** in 11 files |
| Frontend lint and build | pass | pass |
| Playwright, mock data (`test:e2e`) | not run | **61 of 61 passed** |
| Playwright, real backend, local dev servers (`test:e2e:real`) | 9 of 9 passed | **9 of 9 passed** |
| Playwright, real backend, through the HTTPS gateway | not run | **8 passed, 1 skipped** (password reset: production logs no link, see "Known limitations") |

**Docker** (README "Run with Docker", local `.env` and `./certs`, existing database volume): `docker compose up -d --build` left postgres, backend and gateway healthy. Migration 012 was applied to the existing data, the old tables were kept, and the scheduler stayed off with no price feeds configured. Through `https://localhost`:
- `GET /api/health` returned 200, and plain HTTP redirected with 301.
- Register and login worked.
- One asset of each type was created, then edited, revalued manually (history row written) and deleted; the dashboard total followed every change.
- CSV and PDF exports worked.
- Forgot password returned 202, and the token was rejected after logout.

`docker compose down` was run without `-v`, so the volume was kept.

**B26 manual check:** local dev backend with an HTTPS stub price feed. See B26 above.

### Final regression – 2026-11-10

Run on `fix/bug-bash` at `f6cffbba8f81f57e0a03d2ff2a4d080400f0a939` ("Merge pull request #78"), which contains every fix listed as merged into `fix/bug-bash` above. Windows 11, Node 22.19.0, PostgreSQL 16 (Docker), Docker 29.9.2.

| Suite | Result |
|---|---|
| Backend API (`npm test`, throwaway `postgres:16`, database `*_test`) | **206 of 206 passed** in 17 files, 12 migrations applied |
| Frontend unit (`npm test`) | **110 of 110 passed** in 11 files |
| Frontend lint (`npm run lint`) and build (`npm run build`) | pass |
| Playwright suites (`test:e2e`, `test:e2e:real`) | not re-run in this regression; the Playwright browser was only used for the screenshots below |

**Docker / HTTPS gateway check** (README "Run with Docker": `.env` from `.env.example` with a random `JWT_SECRET`, `FRONTEND_ORIGIN=https://localhost`, self-signed certificate in `./certs`, `docker compose up -d --build`). All requests went through `https://localhost/api`.

| Step | Result |
|---|---|
| postgres, backend and gateway healthy | ✅ |
| `GET /api/health` | ✅ `{"status":"ok"}` |
| `http://localhost` redirects to https | ✅ 301 → `https://localhost/` |
| Register, then login | ✅ 201, 200 with JWT |
| Create one asset of each type (REAL_ESTATE, GOLD, STOCK, CASH) | ✅ 201 × 4 |
| `GET /api/dashboard`: totals and allocation | ✅ net worth 5,100,000.00; allocation 98.05 + 1.37 + 0.31 + 0.27 = 100.00 |
| Manual valuation, then `GET /api/valuations/history` | ✅ 200, new value in the history |
| CSV export / PDF export | ✅ `text/csv` with the assets / valid `application/pdf` |
| Forgot password | ✅ 202 |
| Reset link in `docker compose logs backend` (production config, `NODE_ENV=production`) | ❌ by design: in production only `PASSWORD_RESET_REQUESTED` with the user id is logged, and there is no email service, so **reset links cannot be delivered in the Docker deployment**. See "Known limitations". |
| Reset flow, re-run with a temporary, uncommitted compose override `NODE_ENV=development` for the backend (no app code changed; override removed afterwards and the backend restarted with `NODE_ENV=production`) | ✅ reset link in the backend log → reset 200 → old JWT rejected (401) → link cannot be reused (400) → old password rejected (401) → login with the new password 200 → logout 200 → token rejected after logout (401) |
| UI through the gateway (Playwright, certificate errors ignored): login, dashboard, assets and reports pages render | ✅ |
| `docker compose down` (without `-v`); database volume kept | ✅ |

### Known limitations in this release
- **B9 (#67, PR #76):** fixed by B26 once merged. Until a price provider is configured (`STOCK_PRICE_API_URL`, `GOLD_PRICE_API_URL`), the scheduler stays off and stock and gold keep the value the user entered.
- **B25 (PR #86):** no rate limiting on `/api/auth/*` (SAD 3.9).
- **No email service** for password-reset links. Outside production the link is printed to the backend console; in production (including the Docker setup) nothing is sent or logged, so users cannot reset their password until an email provider is added.
- No admin module.
- No percentage-threshold alerts (only price alerts).
- No performance tests.
- Another user's asset returns 404, not the 403 of PRJ-SR-004.
- Authentication uses a Bearer token in `localStorage`, not an httpOnly cookie (deviation from SAD 4.3.1, see `docs/auth-decision.md`).
- Stock tickers are checked by format only; there is no symbol master.

### 2026-11-07: PRs #79, #80, #81 and #82 merged locally

Run on `origin/fix/bug-bash` (`9ade819`) with the four PRs merged in that order, without conflicts. Windows 11, Node 22.19.0, PostgreSQL 16.15 and Docker 29. **This is not the final regression for #58:** PRs #76 and #78 are not included, and it must be repeated on `fix/bug-bash` after all of them are merged.

| Suite | Before | After |
|---|---|---|
| Backend API (`npm test`) | 95 passed | **163 passed** in 14 files |
| Frontend unit (`npm test`) | 48 passed | **82 passed** in 8 files |
| Frontend lint and build | pass | pass |
| Playwright, mock data (`npm run test:e2e`) | 1 of 57 passed | **57 of 57 passed** |
| Playwright, real backend, local (`npm run test:e2e:real`) | none | **7 of 7 passed**, 3 runs in a row |
| Playwright, real backend, through the HTTPS gateway | none | **7 of 7 passed** |
| `npm audit --omit=dev` in `backend` | 1 high | **0** |

Backend test files: `alerts` (8), `assetEndpoints` (20), `assets` (7), `auth` (9), `authHardening` (20), `dashboard` (39), `emailNormalization` (8), `errorFormat` (11), `health` (4), `marketRefresh` (1), `migrate` (5), `registrationValidation` (18), `reports` (5), `valuations` (8).

**Manual gateway checks:** TLS 1.0 and 1.1 refused, 1.2 and 1.3 accepted; HTTP redirects with 301; only ports 80 and 443 published; security headers present once each, with no CSP violations in the app; database outage gives 503 with no API restart, then recovers; data survives `down` and `up`. Full list in PR #82.

**Trial merges with the open PRs:** #76 merges cleanly on top of the four. #78 conflicts in `backend/tests/reports.test.js` with `fix/bug-bash` even without them, because of #77, so it needs rebasing first.

### 2026-11-01: before the teammates' fixes

Run on 2026-11-01 on `fix/bug-bash` (after the B14, B3, B4, B6 and B5 commits), Windows 11, Node 22.19.0, PostgreSQL 16.15 (WSL Ubuntu 22.04).
The teammates' fixes (B1, B2, B7, B7b, B11, B13, B15) and Rushikesh's untracked bugs are not merged yet, so the final regression in #58 must be repeated after their PRs land in `fix/bug-bash`.

### Automated suites

| Suite | Command | Result |
|---|---|---|
| Backend API (Vitest + Supertest, real PostgreSQL) | `cd backend && npm ci && npm test` | **76 passed** in 7 files (before this branch: no tests; `npm test` exited 1) |
| Frontend unit (Vitest) | `cd frontend && npm ci && npm test` | **48 passed** in 4 files (unchanged) |
| Frontend lint (oxlint) | `npm run lint` | pass, 0 errors, 1 warning (see "New findings") |
| Frontend build (Vite) | `npm run build` | pass |

Backend test files: `auth` (9), `assets` (7), `reports` (3), `emailNormalization` (8), `registrationValidation` (18), `errorFormat` (11), `assetEndpoints` (20).

The backend tests need a PostgreSQL user that can create databases. Configuration comes only from the environment, for example:

```
DB_HOST=127.0.0.1 DB_PORT=5432 POSTGRES_USER=<user> POSTGRES_PASSWORD=<password> POSTGRES_DB=pwm_app_test npm test
```

`POSTGRES_DB` must end in `_test`: the suite drops and recreates it, applies `backend/database/migrations/*.sql` in order and drops it again at the end. In CI the same suite runs against a `postgres:16` service container.

### Manual smoke test

Real server (`node src/app.js`, port 5055) against a freshly migrated database (8 migrations), driven with curl:

| Step | Request | Result |
|---|---|---|
| Health | `GET /health` | 200 |
| Register | `POST /api/auth/register` with `" Smoke.Tester@Example.com "` | 201, stored as `smoke.tester@example.com` |
| Login | `POST /api/auth/login` with `SMOKE.TESTER@example.com` | 200, JWT returned |
| Create asset | `POST /api/assets` (REAL_ESTATE, 8200000) | 201 (purchase date shifted, see "New findings") |
| List | `GET /api/assets?type=REAL_ESTATE` | 200, `{items:[...], page:1, limit:50, total:1}` |
| Revalue | `PUT /api/assets/1/valuation` `{"value":"8500000.00"}` | 200, `currentValue` 8500000.00 |
| Export CSV | `GET /api/reports/export/csv` | 200 `text/csv`, header + 1 asset row with the new value |
| Export without token | `GET /api/reports/export/csv` | 401 `{"error":{"code":"UNAUTHORIZED",...}}` |

The smoke database was dropped afterwards.

### CI

`.github/workflows/main.yml` now runs the backend tests (with a `postgres:16` service) and the frontend unit tests on pushes and pull requests to `main` and `fix/bug-bash`. CI results for this branch are visible once it is pushed.
