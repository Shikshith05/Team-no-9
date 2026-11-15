# Deviations from the SRS and SAD

**Project:** Personal Wealth Management Software  
**Owner:** QA Lead – Rushikesh Praveen Patil  
**Source:** `docs/bug-log.md` (“Known limitations in this release”), `docs/auth-decision.md`, `README.md`, SRS v1.0 and SAD v1.3.  
**Baseline:** Repository ZIP supplied for final QA documentation, with team status update dated 14 November 2026.

This document records implemented behaviour that differs from the SRS/SAD, plus explicitly unimplemented or unverified requirements. It does not silently treat a limitation as a completed requirement.

## 1. Password-reset email delivery

- **SRS requirement:** PWM-F-003 expects a password-reset link delivered by verified email.
- **SAD design:** password-reset notification is routed through the notification/outbox and email-provider design.
- **Implemented behaviour:** in non-production, the backend prints the reset link to its console. In production, the application logs only `PASSWORD_RESET_REQUESTED` with the user ID; it does not send or expose a reset link.
- **Impact:** production users cannot complete password reset until an email provider is integrated.
- **Evidence:** `README.md` (“Password reset (no email yet)”), `docs/bug-log.md` known limitations, `backend/tests/passwordReset.test.js`.

## 2. Admin module not implemented

- **SRS/SAD scope:** administrator capabilities are described in SRS Section 2.3 and SAD Sections 3.4 / 4.8.
- **Implemented behaviour:** no Admin module is delivered. The Settings placeholder was removed in B27 rather than presenting an unimplemented page.
- **Impact:** administrator health/settings/user-management and related admin workflows are unavailable.
- **Evidence:** `docs/bug-log.md` B27 and known limitations; STP cases TC-Adm-01 to TC-Adm-03.

## 3. Percentage-threshold alerts not implemented

- **SRS requirements:** PWM-F-040, PWM-F-041 and PWM-F-042 describe percentage-change thresholds, breach notifications and 24-hour throttling.
- **Implemented behaviour:** the delivered alert functionality is price-based; percentage-threshold alert behaviour is not implemented.
- **Impact:** users cannot configure the full net-worth / asset percentage-change alert behaviour specified by the SRS.
- **Evidence:** `docs/bug-log.md` known limitations; SRS Section 4.5; STP cases TC-Alert-01 to TC-Alert-03.

## 4. Performance and scale requirements not verified

- **SRS requirements:** PWM-NF-001 (dashboard p90 <= 2 seconds), PWM-NF-002 (refresh up to 500 holdings within 5 minutes), PWM-NF-005 (1,000 users without redesign).
- **Implemented / verified behaviour:** the supplied final regression log explicitly states that performance tests were not run.
- **Impact:** these quantitative performance and scalability targets cannot be claimed as verified.
- **Evidence:** `docs/bug-log.md` final regression table; STP cases TC-Perf-01, TC-Perf-02 and TC-Scale-01.

## 5. Authorization response code differs from SRS acceptance criterion

- **SRS requirement:** PRJ-SR-004 acceptance criterion specifies HTTP 403 for cross-user access.
- **Implemented behaviour:** requesting another user's asset returns HTTP 404.
- **Impact:** ownership isolation is enforced, but the exact status code differs from the SRS acceptance criterion.
- **Evidence:** `docs/bug-log.md` known limitations; `backend/tests/assetEndpoints.test.js` and related ownership tests.

## 6. Authentication token storage differs from SAD

- **SAD design:** httpOnly, Secure, SameSite=Strict cookie.
- **Implemented behaviour:** JWT is returned in the login response and stored in `localStorage` under the key `token`; API calls send `Authorization: Bearer <token>`.
- **Reason recorded by the team:** the backend already used Bearer tokens, and the frontend/backend authentication mismatch was resolved by adopting the existing Bearer-token approach.
- **Risk:** scripts running in the page can read `localStorage`; an XSS vulnerability could expose the token. The team records mitigations including React output escaping, same-origin CSP, token expiry and server-side logout revocation.
- **Evidence:** `docs/auth-decision.md`; `docs/bug-log.md` B2; STP TC-Auth-02 and TC-Sec-06 need to be interpreted against this accepted design decision.

## 7. Stock ticker validation is format-only

- **SRS/STP expectation:** TC-Stock-01 expects a known ticker to be accepted and an unknown ticker to be rejected through ticker lookup.
- **Implemented behaviour:** ticker input is checked for format only; there is no authoritative symbol master.
- **Impact:** syntactically valid but unknown symbols may not be rejected at asset-entry time.
- **Evidence:** `docs/bug-log.md` known limitations; STP TC-Stock-01.

## 8. Market refresh depends on external feed configuration

- **SRS requirements:** PWM-F-020 and PWM-F-021 cover automatic stock and gold valuation refresh; PWM-F-024 covers cached prices and stale status.
- **Implemented behaviour:** B26 implements stock/gold revaluation and refresh handling. The scheduler starts only when both `STOCK_PRICE_API_URL` and `GOLD_PRICE_API_URL` are configured.
- **Impact:** without configured feed URLs, the scheduler remains off and stock/gold values remain at the values entered by the user; automated live revaluation is therefore not active in that configuration.
- **Evidence:** `README.md` configuration table; `docs/bug-log.md` B26 and known limitations; `backend/src/services/marketRefresh.js`; `backend/tests/marketRefresh.test.js`.

## 9. B9 replaced by B26; B25 release gate needs confirmation

- **B9:** the original market-price cache / valuation-history work in PR #76 is marked superseded by B26 in `docs/bug-log.md`. B26 is the replacement implementation for stock/gold revaluation.
- **B25:** `VERIFICATION_LOG.md` marks rate limiting as passed, while the bug-log release note states that B25 is not included unless the 227-backend-test condition passes. The final release evidence should identify the merged commit and attach the passing 227-test output.
- **Impact:** this is a documentation / release-evidence reconciliation item. Do not list B9 as an unresolved duplicate of B26, and do not claim B25 release inclusion without the required evidence.
- **Evidence:** `docs/bug-log.md` B9, B25, B26 and release notes; `VERIFICATION_LOG.md`.

## 10. Responsive browser coverage is not fully cross-browser

- **SRS requirement:** PWM-NF-004 / TC-UX-01 calls for responsive usability at 360px through desktop and across Chrome, Firefox, Safari and Edge.
- **Implemented / verified behaviour:** the responsive test log records automated Chromium coverage at 360px, 768px and 1280px, and screenshot checks for selected dark-mode views. It explicitly states that Firefox, Safari and Edge still need manual testing.
- **Impact:** responsive behaviour is evidenced in Chromium but full cross-browser acceptance is not demonstrated.
- **Evidence:** `docs/responsive-test-log.md`; STP TC-UX-01.

## 11. Summary

The deviations above should remain visible in the final SRS RTM and STP results. Requirements that are implemented and tested may be marked **P**; requirements that remain unavailable or unverified should be marked **N** with the limitation and evidence referenced. A test that was not run must not be reported as passed.
