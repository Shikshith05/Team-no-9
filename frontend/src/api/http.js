// Fetch wrapper for the REST API (SAD 4.3.1).
// Every request carries the stored token as "Authorization: Bearer <token>"
// (B2, #60; see docs/auth-decision.md). Error responses become an ApiError
// carrying the SAD error shape:
//   {"error": {"code": "VALIDATION_ERROR", "message": "...",
//              "fields": [{"field": "value", "message": "must be 0 or more"}]}}
// A 401 means the session is missing, expired or revoked (PRJ-SR-003): the
// session is cleared and the app goes to #/login, wherever the 401 came from.
// The exceptions are the login and register forms, where a 401 is an answer
// about the credentials just typed and is shown on the form.
import { expireSession, getToken } from './session.js';

const NO_SESSION_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

export class ApiError extends Error {
  constructor(status, { code, message, fields } = {}) {
    super(message || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code ?? null;
    this.fields = Array.isArray(fields) ? fields : [];
  }
}

// Sends the request and handles what every call has in common: the token, a
// network failure, 401, and the error body. Returns the Response when it is ok.
async function send(path, { method, headers, body }) {
  const token = getToken();
  const init = { method, headers: { ...headers } };
  if (token) init.headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, init);
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'Could not reach the server.' });
  }

  if (res.ok) return res;

  // Don't end a newer session because of a slow reply to an older request.
  if (res.status === 401 && !NO_SESSION_PATHS.has(path) && getToken() === token) {
    expireSession();
  }
  throw new ApiError(res.status, parseJson(await res.text())?.error ?? {});
}

function parseJson(text) {
  if (!text) return null; // 202 and 204 replies have no body.
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiFetch(path, { method = 'GET', body } = {}) {
  const res = await send(path, { method, body, headers: { Accept: 'application/json' } });
  return parseJson(await res.text());
}

/** GET a file (CSV or PDF export) with the same auth and error handling as apiFetch. */
export async function apiDownload(path, accept) {
  const res = await send(path, { method: 'GET', headers: { Accept: accept } });
  return res.blob();
}

export function isUnauthorized(error) {
  return error?.status === 401;
}

/** Field-level messages from a VALIDATION_ERROR, keyed by field name. */
export function fieldErrors(error) {
  return Object.fromEntries((error?.fields ?? []).map((f) => [f.field, f.message]));
}
