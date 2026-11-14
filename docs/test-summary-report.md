# Test Summary Report

**Project:** Personal Wealth Management Software  
**Team:** Team 9 (Section G)  
**Role / owner:** QA Lead – Rushikesh Praveen Patil  
**Release baseline:** `main` (team-reported final release status, 14 November 2026)  
**Source baseline inspected:** `Team-no-9-main` ZIP, including `docs/bug-log.md`, `VERIFICATION_LOG.md`, SRS v1.0, SAD v1.3 and STP v1.0.

## 1. Purpose

This report summarizes the verification evidence available for the Personal Wealth Management application, records the reported test results, tracks defects B1–B27, identifies known limitations and provides a QA sign-off section.

## 2. Test scope

The application scope covered by the available repository evidence includes:

- Authentication: registration, login, logout, password reset and account lockout.
- Asset management: create, read, update and delete for real estate, gold, stocks and cash/bank assets.
- Valuation: manual valuation, stock/gold market refresh, valuation history, cached prices and stale-state handling.
- Dashboard: net worth, asset allocation and net-worth trend.
- Reporting: CSV and PDF exports, including valuation history.
- Alerts: persisted per-user price alerts and alert handling.
- Security and infrastructure: authorization, password hashing, JWT expiry/logout invalidation, security headers, TLS gateway, PostgreSQL migrations and Docker services.
- Responsive UI and browser journeys.

The SRS/STP also define requirements for an Admin module, email delivery, performance, uptime, scale and some security behaviours. These are not all implemented or fully verified; see Sections 6 and 7.

## 3. Test environment

The repository's final regression evidence records the following environment:

| Component | Environment |
|---|---|
| Operating system | Windows 11 |
| Node.js | 22.19.0 |
| Database | PostgreSQL 16 (Docker) |
| Docker | 29.9.2 (recorded in the November 10 regression log) |
| Backend test framework | Vitest with Supertest |
| Frontend unit test framework | Vitest |
| Browser automation | Playwright / Chromium |
| Application gateway | Docker Compose with Nginx and local HTTPS certificate |

Backend tests use a dedicated disposable PostgreSQL database whose name ends in `_test`. The repository README warns that the backend test setup drops and recreates this database. A development database must not be used as the test database.

## 4. Tests run and results

### 4.1 Latest local QA results (14 November 2026)

The following results were verified during the latest local QA run:

| Test area | Verified result |
|---|---:|
| Backend automated tests | 227 passed |
| Frontend unit tests | 111 passed |
| Playwright browser tests (mock-data suite) | 63 passed |
| Playwright real-backend journey | 9 passed |
| **Total automated tests** | **410 passed** |

The latest real-backend Playwright run completed with 9 passed, 0 failed and 0 skipped. The frontend checks also completed successfully: lint reported 0 warnings and 0 errors, and the production build succeeded.

### 4.2 Earlier repository verification evidence (10 November 2026)

`VERIFICATION_LOG.md` and `docs/bug-log.md` contain a dated regression record from 10 November 2026:

| Test area | Recorded result |
|---|---:|
| Backend API tests | 224 passed, 17 files |
| Frontend unit tests | 111 passed, 11 files |
| Frontend lint and build | Passed |
| Playwright mock-data suite | 61 of 61 passed |
| Playwright real-backend suite | 9 of 9 passed |
| Playwright through HTTPS gateway | 8 passed, 1 skipped (password-reset delivery limitation) |
| Docker services | PostgreSQL, backend and gateway healthy |
| HTTPS health check | HTTP 200 |
| HTTP-to-HTTPS redirect | HTTP 301 |

**Evidence reconciliation note:** The 10 November repository log records 224 backend tests and 61 mock-data Playwright tests. The newer 14 November local QA run records 227 backend tests and 63 mock-data Playwright tests. These are separate dated runs; the earlier figures are retained here as historical evidence and are not presented as the latest result. Attach the corresponding latest test output to the final submission. The repository log also records the separate HTTPS-gateway run (8 passed, 1 skipped).

### 4.3 Commands and evidence locations

| Test area | Command / evidence |
|---|---|
| Backend | `cd backend` then `npm test` |
| Frontend unit | `cd frontend` then `npm test` |
| Frontend lint | `cd frontend` then `npm run lint` |
| Frontend build | `cd frontend` then `npm run build` |
| Playwright mock-data | `cd frontend` then `npm run test:e2e` |
| Playwright real backend | `cd frontend` then `npm run test:e2e:real` |
| Backend test setup | `backend/tests/setup/` |
| Backend tests | `backend/tests/*.test.js` |
| Frontend tests | `frontend/src/**/*.test.*` |
| Responsive test log | `docs/responsive-test-log.md` |
| Regression and manual Docker evidence | `docs/bug-log.md`, `VERIFICATION_LOG.md` |

The repository's backend test command is `vitest run`; frontend tests also use Vitest. Playwright is used for browser-level tests.

## 5. Defect summary (B1–B27)

Statuses below follow the supplied `docs/bug-log.md` summary, with the later team-reported release status noted where applicable.

| ID | Defect summary | Status / disposition |
|---|---|---|
| B1 | Login page not connected to login API | Fixed |
| B2 | Frontend/backend authentication mismatch | Fixed; Bearer token in `localStorage` is an accepted documented deviation |
| B3 | Case-sensitive duplicate accounts | Fixed |
| B4 | Missing registration validation | Fixed |
| B5 | Missing asset APIs | Fixed |
| B6 | Inconsistent API errors and database error leakage | Fixed |
| B7 | Valuation rows referenced the wrong asset records | Fixed |
| B7b | Valuation history missing from exports | Fixed |
| B8 | One failed stock ticker stopped the entire refresh | Fixed |
| B9 | Market-price cache semantics and refresh history issue | Superseded by B26; earlier PR #76 is not the release implementation |
| B10 | Obsolete frontend valuation worker and duplicate services | Fixed |
| B11 | Dashboard endpoint mismatch | Fixed |
| B12 | Dashboard alerts not persisted per user | Fixed |
| B13 | Export date formatting | Fixed |
| B14 | Backend tests and CI coverage missing | Fixed |
| B15 | Dockerfiles, Nginx configuration and certificate references missing | Fixed |
| B16 | Lockout re-locked after expiry | Fixed |
| B17 | JWT lifetime hard-coded | Fixed |
| B18 | Missing security headers / X-Powered-By exposed | Fixed |
| B19 | `.env.example` missing JWT and CORS settings | Fixed |
| B20 | README lacked run instructions | Fixed |
| B21 | Login immediately after logout could receive a revoked token | Fixed |
| B22 | Asset types lacked required fields and type validation | Fixed |
| B23 | Asset create/edit/delete UI missing | Fixed |
| B24 | Forgot/reset password endpoints missing | Fixed; email delivery remains limited |
| B25 | Authentication API rate limiting missing | Marked fixed in `VERIFICATION_LOG.md`; bug log release note makes inclusion conditional on the final 227-backend-test gate. Confirm merged release commit and attach the passing 227-test output before final sign-off. |
| B26 | Market refresh did not revalue stock/gold assets | Fixed; supersedes B9 |
| B27 | Settings menu showed an unbuilt placeholder | Fixed |

## 6. Known limitations and deviations

The following limitations are explicitly recorded in the supplied bug log, README or auth decision:

1. **Password-reset email delivery is not implemented.** In non-production, the reset link is printed to the backend console. In production/Docker, no reset link is delivered or logged; users cannot complete password reset until an email provider is added.
2. **Admin module is not implemented.** Admin health/settings/user-management capabilities in the SRS/SAD remain unavailable.
3. **Percentage-threshold alerts are not implemented.** The implemented alert capability is price-based; do not claim the SRS percentage-threshold alert behaviour is complete.
4. **Performance tests have not been run.** The SRS performance targets (including dashboard p90 and 500-holding refresh time) are not verified by the supplied regression evidence.
5. **Cross-user asset access returns 404 rather than the SRS-specified 403.** Ownership isolation is implemented, but the exact response code deviates from PRJ-SR-004 acceptance criteria.
6. **Authentication token storage differs from the SAD design.** The app uses a Bearer token stored in `localStorage`, rather than an httpOnly, Secure, SameSite cookie. The decision and accepted XSS exposure are documented in `docs/auth-decision.md`.
7. **Stock ticker validation checks format only.** There is no authoritative symbol master / live symbol lookup in the delivered implementation.
8. **Market refresh requires configured price-feed URLs.** When `STOCK_PRICE_API_URL` and `GOLD_PRICE_API_URL` are not configured, the scheduler remains off and stock/gold values remain at the user-entered values.
9. **B25 release evidence needs reconciliation.** The verification log marks B25 as passed, while the bug-log release note says it is not included unless the 227-backend-test gate passes. Verify the release commit and attach the relevant test output.

## 7. Items not demonstrated by the supplied evidence

The following planned acceptance criteria are not demonstrated as passing in the supplied final regression evidence:

- `TC-Perf-01` / `PWM-NF-001`: dashboard p90 load time at or below 2 seconds under production-like load.
- `TC-Perf-02` / `PWM-NF-002`: refresh of 500 market-linked holdings within 5 minutes.
- `PWM-NF-003`: 99.5% monthly uptime.
- `TC-Scale-01` / `PWM-NF-005`: 1,000-user scalability load test.
- Full cross-browser manual verification for Firefox, Safari and Edge; responsive test log records automated Chromium coverage and says other browsers still need manual testing.
- Email delivery for password reset and the full Admin module.

These are reported as not verified / known limitations, not as passed tests.

## 8. QA sign-off

**QA Lead:** Rushikesh Praveen Patil  
**Sign-off status:** Pending final evidence reconciliation.

Before final sign-off, confirm:

- the final `main` commit includes the intended B25 rate-limiting change;
- the final backend test output supports the required 227-test gate (if B25 is included);
- the latest Playwright output supports the 63 mock-data and 9 real-backend results;
- the SRS/STP originals and exported PDFs are updated by the document owner.

**QA conclusion:** The available evidence demonstrates broad functional, API, UI, database and browser verification, together with reported local Docker/HTTPS verification from the earlier regression record. The limitations in Sections 6 and 7 remain explicit and should not be represented as completed requirements.
