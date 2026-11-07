# Authentication: Bearer token in localStorage (deviation from the SAD)

Decided for B2 ([#60](https://github.com/Shikshith05/Team-no-9/issues/60)). Requirements: PWM-F-002, PRJ-SR-003, PRJ-SR-004.

## The deviation

| | SAD (3.6, 3.9, 4.3.1, ADR 5.4) | What we built |
|---|---|---|
| Where the JWT lives | httpOnly, Secure, SameSite=Strict cookie | `localStorage`, under the single key `token` |
| How it is sent | Cookie, automatically | `Authorization: Bearer <token>` header |
| Login reply | Sets the cookie | Returns `{ token, user }` in the body |
| Cross-site protection | SameSite cookie plus an Origin check | No cookie is sent automatically, so CSRF does not apply; CORS allows only `FRONTEND_ORIGIN` |

## Why

The backend already used Bearer tokens (`authMiddleware.js`), and the frontend was half cookie, half Bearer. That mismatch was bug B2. The team picked the option that needed no backend or proxy changes and works the same in local development and behind the gateway.

## The accepted risk

The SAD's ADR rejected this option for a reason: **any script running on the page can read `localStorage`, so an XSS bug could steal the token.** A cookie-based design would not have this exposure. It is reduced, not removed, by:

- React escaping output, with nothing rendered as raw HTML (SAD 3.9).
- A Content-Security-Policy on the gateway that allows only same-origin scripts (B15).
- Token expiry, default 24 hours (PRJ-SR-003, B17).
- Server-side revocation on logout through `token_blacklist` (PRJ-SR-003).

STP test cases TC-Auth-02 and TC-Sec-06 expect the cookie and its flags. Read them as "the token is returned in the reply and sent as a Bearer header" until the team revisits this decision.

## Rules for the code

- Only `frontend/src/api/session.js` reads or writes the stored session. No other file touches `localStorage` for auth, and there is no second key such as `auth_token`.
- All API calls go through `frontend/src/api/http.js` (`apiFetch`, or `apiDownload` for files), which attaches the token.
- A 401 from any endpoint clears the session and redirects to `#/login`. The exceptions are the login and register forms, where the reply is shown on the form.
- Logout calls `POST /api/auth/logout` so the token is revoked on the server, then clears the session. If the server can't be reached, the browser is still logged out, and the token stays valid until it expires.

## Moving to the SAD design later

Set the cookie in `authController.login`, read it in `authMiddleware`, add the Origin check, and reduce `session.js` to a "logged in" flag. `http.js` is then the only frontend file that needs to change how requests are sent.
