# Sprint 3 Bug Log

Bug bash for the Personal Wealth Management app. Tracking issue: [#52](https://github.com/Shikshith05/Team-no-9/issues/52).
Integration branch: `fix/bug-bash`. Each bug has its own issue, owner and fix branch, and every fix needs a test (#52).

Owners (from #52): Shikshith: B3, B4, B5, B6, B14, bug log; Sateesh: B1, B2, B11, B15; Greeshma: B7, B7b, B13; Rushikesh: B8, B9, B10, B12.

Status as of 2026-11-01.

## Summary

| Bug | Issue | Title | Assignee | Status |
|---|---|---|---|---|
| B1 | [#59](https://github.com/Shikshith05/Team-no-9/issues/59) | Connect login page to /api/auth/login | Sateesh5298 | Open – assigned to Sateesh |
| B2 | [#60](https://github.com/Shikshith05/Team-no-9/issues/60) | Resolve frontend and backend authentication mismatch | Sateesh5298 | Open – assigned to Sateesh |
| B3 | [#56](https://github.com/Shikshith05/Team-no-9/issues/56) | Normalize email addresses to prevent case-sensitive duplicate accounts | Shikshith05 | Fixed in this branch |
| B4 | [#57](https://github.com/Shikshith05/Team-no-9/issues/57) | Add email format and password strength validation during registration | Shikshith05 | Fixed in this branch |
| B5 | [#54](https://github.com/Shikshith05/Team-no-9/issues/54) | Implement missing asset APIs | Shikshith05 | Fixed in this branch (valuation-history row waits for B7) |
| B6 | [#55](https://github.com/Shikshith05/Team-no-9/issues/55) | Standardize API error responses and prevent database error leakage | Shikshith05 | Fixed in this branch |
| B7 | [#63](https://github.com/Shikshith05/Team-no-9/issues/63) | Fix valuation asset relationship and implement valuation history API | GREESHMA-K77 | Open – assigned to Greeshma |
| B7b | [#64](https://github.com/Shikshith05/Team-no-9/issues/64) | Restore secure valuation history in CSV and PDF exports | GREESHMA-K77 | Open – assigned to Greeshma (blocked by B7) |
| B8 | none | Not recorded (no GitHub issue yet) | Rushikesh (per #52) | Open – no tracking issue |
| B9 | none | Not recorded (no GitHub issue yet) | Rushikesh (per #52) | Open – no tracking issue |
| B10 | none | Not recorded (no GitHub issue yet) | Rushikesh (per #52) | Open – no tracking issue |
| B11 | [#61](https://github.com/Shikshith05/Team-no-9/issues/61) | Fix dashboard endpoint mismatch between frontend and backend | Sateesh5298 | Open – assigned to Sateesh |
| B12 | none | Not recorded (no GitHub issue yet) | Rushikesh (per #52) | Open – no tracking issue |
| B13 | [#65](https://github.com/Shikshith05/Team-no-9/issues/65) | Standardize date formatting in CSV and PDF exports | GREESHMA-K77 | Open – assigned to Greeshma |
| B14 | [#51](https://github.com/Shikshith05/Team-no-9/issues/51) (duplicate: [#53](https://github.com/Shikshith05/Team-no-9/issues/53)) | Backend has no tests and CI only runs a syntax check | Shikshith05 | Fixed in this branch |
| B15 | [#62](https://github.com/Shikshith05/Team-no-9/issues/62) | Fix missing Dockerfiles, Nginx configuration and certificate references | Sateesh5298 | Open – assigned to Sateesh |

Open items that block closing #58 (its acceptance criteria say every bug must have its own issue and no critical bug may remain open):
- B8, B9, B10 and B12 have no GitHub issue, so their titles, steps and root causes are not recorded here. Rushikesh needs to create them.
- B7 is a cross-user data-exposure risk (valuation IDs collide across asset tables) and is still open. B5's valuation history write and B7b both depend on it.
- B14 has two issues (#51 and #53). The fix references both; #53 can be closed as a duplicate.

## Details

### B1 – Login page not connected (#59)
- **Steps to reproduce:** open `#/login`, enter any email and password, press Log in. The page shows "Logging in isn't connected yet" and no request is sent.
- **Root cause:** `frontend/src/pages/LoginPage.jsx` is still the Sprint 2 placeholder; its submit handler never calls `POST /api/auth/login`.
- **Fix / tests:** pending (depends on B2).

### B2 – Frontend and backend authentication mismatch (#60)
- **Steps to reproduce:** log in through the API, then open Reports and export. Asset screens send a cookie (`credentials: 'include'` in `frontend/src/api/http.js`); the backend only reads `Authorization: Bearer` (`authMiddleware.js`); `ReportsPage.jsx` reads a `token` from `localStorage` that no login flow ever writes.
- **Root cause:** no agreed authentication method; each side implemented a different one.
- **Fix / tests:** pending. Needs the team decision recorded in #52 (Bearer token vs secure cookie).

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
- **Known gap:** the MANUAL row in `valuations` is not written yet, because `valuations.asset_id` still points at the per-type tables (B7). A TODO marks the place. `location` and `purchaseValue` are null because the unified table has no such columns.
- **Tests:** `backend/tests/assetEndpoints.test.js`.

### B6 – Inconsistent errors and database error leakage (#55) – Fixed
- **Steps to reproduce (before):** `POST /api/assets` with `"purchaseDate":"not-a-date"` returns 400 with PostgreSQL's raw message; most errors are `{"success":false,"message":...}` instead of the SAD shape; a database outage during the token check is reported as "Invalid or expired token".
- **Root cause:** each controller built its own error body and sent `error.message` to the client.
- **Fix:** `backend/src/utils/errors.js` (AppError, central `errorHandler`, JSON 404 for unknown `/api` routes). Every error is `{"error":{"code","message","fields"}}`, which `frontend/src/api/http.js` reads. Codes: VALIDATION_ERROR 400, UNAUTHORIZED 401, ACCOUNT_LOCKED 423, NOT_FOUND 404, CONFLICT 409, MARKET_VALUED 422, INTERNAL_ERROR 500 (generic message; details only in the server log). Asset input is validated with field errors. Wrong password and unknown email now return identical 401 bodies (the old `remainingAttempts` field revealed which emails exist).
- **Tests:** `backend/tests/errorFormat.test.js`, plus the shape checks in the other suites.

### B7 – Valuation rows point at the wrong asset table (#63)
- **Steps to reproduce:** `valuations.asset_id` (migration 005) is a plain BIGINT matched against the per-type tables, which each have their own ID sequence. Real estate asset 1 and gold asset 1 share `asset_id = 1`, and none of these tables has a `user_id`, so a valuation cannot be tied to its owner.
- **Root cause:** valuations were designed before the unified `assets` table existed.
- **Fix / tests:** pending. Blocks the B5 valuation-history write and B7b.

### B7b – Valuation history removed from exports (#64)
- **Steps to reproduce:** export CSV or PDF. Only current assets are listed; the PDF says valuation history is "temporarily omitted".
- **Root cause:** history was removed on purpose to stop the cross-user leak described in B7.
- **Fix / tests:** pending, after B7.

### B8, B9, B10, B12 – No tracking issues
Listed in #52 as Rushikesh's, but no GitHub issues exist, so title, steps to reproduce and root cause are not known to the bug log.

### B11 – Dashboard endpoint mismatch (#61)
- **Steps to reproduce:** set `VITE_USE_MOCK_API=false` and open the dashboard. The frontend calls `GET /api/dashboard` and `GET /api/dashboard/trend`; the backend only has `GET /api/assets/dashboard-summary`, so both return 404.
- **Root cause:** frontend and backend were built against different contracts.
- **Fix / tests:** pending.

### B13 – Export date formats (#65)
- **Steps to reproduce:** risk of JavaScript default date strings (`Fri Oct 30 2026 ...`) in CSV/PDF.
- **Root cause / current state:** `reportController.js` on `main` already formats `purchase_date` as `YYYY-MM-DD` and `created_at` as ISO 8601 UTC in SQL, as the issue's own note says. What remains is verifying it and adding the timezone tests the issue asks for.
- **Fix / tests:** pending.

### B14 – No backend tests, CI only checks syntax (#51, duplicate #53) – Fixed
- **Steps to reproduce (before):** `cd backend && npm test` exits 1 ("no test specified"); `.github/workflows/main.yml` only runs `node --check` for the backend and never runs the frontend's Vitest suite.
- **Root cause:** no test setup existed.
- **Fix:** Vitest + Supertest; a helper that drops and recreates the test database (`POSTGRES_DB` must end in `_test`), applies the migrations in filename order (stripping the BOM in 007) and truncates all tables before each test; JWT_SECRET is generated per run. CI gets a `postgres:16` service and runs `npm test` in both the backend and frontend jobs, also for `fix/bug-bash`.
- **Tests:** baseline suites `auth`, `assets`, `reports` (18 tests), then each fix added its own.

### New findings during regression (no issue yet)
- **Asset create/update return the purchase date shifted by a day.** `POST /api/assets` with `"purchaseDate":"2021-03-15"` answers `"purchase_date":"2021-03-14T18:30:00.000Z"`: node-pg turns a DATE into midnight in the server's time zone (IST), which is the previous day in UTC. The stored value is correct, and the new `GET /api/assets` endpoints return `2021-03-15`. Fix: format the date in SQL (as the report and list queries do) or set a pg type parser for DATE. Needs an issue and an owner.
- **Backend dependency advisory.** `npm audit --omit=dev` reports 1 high-severity advisory in `body-parser` 2.0.0–2.3.0 (pulled in by Express, already in the lockfile on `main`). `npm audit fix` should resolve it; needs an issue.
- **Lint warning in `frontend/src/valuationWorker.js`** (unused catch parameter, line 35). Not an error, so lint passes; belongs to the market refresh work (Rushikesh).

### B15 – Missing Docker and Nginx files (#62)
- **Steps to reproduce:** `docker compose build`. `docker-compose.yml` builds `frontend/Dockerfile` and `backend/Dockerfile` and mounts `./nginx.conf` and `./certs`; none of these exist in the repository.
- **Root cause:** compose file was added without the files it references.
- **Fix / tests:** pending.

## Regression testing

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
