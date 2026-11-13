# Sprint Verification Log - GREESHMA-K77

This log records the final status of the Sprint 3 implementation, with the requirement traceability and verification evidence anchored to the repository bug log and automated tests.

## SRS status

Status: Finalized draft-to-final RTM summary retained in repository documentation.

## RTM summary (P = done / N = not done, known limitation)

| Requirement / area | Status | Evidence |
|---|---|---|
| PWM-F-020 / TC-Val-01 (stock valuation refresh) | P | `docs/bug-log.md` B26 and `backend/tests/marketRefresh.test.js` cover stock revaluation, stale flagging, and MARKET rows. |
| PWM-F-021 / TC-Val-02 (gold valuation refresh) | P | `docs/bug-log.md` B26 and `backend/tests/marketRefresh.test.js` cover gold revaluation and cache handling. |
| PWM-F-023 / valuation history | P | `backend/tests/valuations.test.js` verifies only active ownership data appears, with filters and ordering. |
| PWM-F-033 / CSV and PDF exports | P | `backend/tests/reports.test.js` validates auth, CSV/PDF generation, and exclusion of deleted/foreign data. |
| PRJ-SR-003 / secure login session handling | P | `docs/auth-decision.md`, `backend/tests/auth.test.js`, and `frontend/e2e-real/journey.spec.js` confirm token storage and auth flow. |
| PRJ-SR-004 / ownership and per-user data isolation | P | `backend/tests/assets.test.js` and `backend/tests/assetTypes.test.js` validate ownership and DB-level constraints. |
| PRJ-SR-005 / account lockout | P | `backend/tests/auth.test.js` checks failed-attempt lockout behavior. |
| PWM-F-010 to PWM-F-015 / typed asset creation and validation | P | `backend/tests/assetTypes.test.js` verifies valid creations, type validation, and DB checks. |
| PWM-F-014 / asset add/edit/delete UI | P | `docs/bug-log.md` B23 and `frontend/src/lib/assetForm.test.js` / `frontend/src/pages/AssetsPage.test.jsx` cover CRUD behavior. |
| B25 / auth rate limiting | P | `backend/tests/auth.ratelimit.test.js` validates 429 behavior and IP isolation. |
| B26 / stale cache and market refresh integration | P | `backend/tests/marketRefresh.test.js` validates refresh success, stale failure behavior, and scheduler behavior. |
| PWM-F-003 / forgot-password reset flow | N | Known limitation recorded in `README.md`: email delivery is not implemented for production; the backend prints reset links in non-production. |

## STP verification results for the data cases

### 1) Valuation history data case
Status: P (pass)

Evidence:
- `backend/tests/valuations.test.js`
- Confirms filtering to active assets only, ownership isolation, assetId filtering, and correct ordering.

### 2) Exports data case
Status: P (pass)

Evidence:
- `backend/tests/reports.test.js`
- Confirms CSV and PDF exports require auth, list only the logged-in user’s active assets, exclude deleted or foreign entries, and preserve date formatting.

### 3) DB/schema validation data case
Status: P (pass)

Evidence:
- `backend/tests/migrate.test.js`
- `backend/tests/assetTypes.test.js`
- Confirms migrations apply in filename order, are safe to re-run, and DB constraints reject invalid typed-asset data.

## Project board status note

The GitHub Project board itself cannot be updated from this environment because the board API is not exposed in the available tools. The repository maintains the Sprint 3 completion record here and in `docs/bug-log.md`.

The Sprint 3 implementation evidence recorded in this repo is as follows:
- B23: asset CRUD and validation improvements – complete
- B25: auth rate limiting – complete
- B26: market refresh and stale data handling – complete
- earlier migration and schema validation work – complete

The manual GitHub UI action to move Sprint 3 items to Done is still required in the GitHub project board itself.

## Final repository summary

- SRS status: Finalized repository-level RTM summary maintained in docs.
- STP result: All checked data cases pass in repository test evidence.
- Known limitation: email delivery for password reset remains an explicit non-production limitation and is recorded as N.
