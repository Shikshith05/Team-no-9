// The one place that touches the stored session (B2, #60).
// Team decision: Bearer JWT in localStorage under the single key `token`.
// This deviates from SAD 4.3.1 (httpOnly cookie); see docs/auth-decision.md.
// PRJ-SR-003: the server rejects expired or revoked tokens; expireSession()
// is how the client reacts to that.

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage unavailable (blocked by the browser, or no DOM)
  }
}

export function hasSession() {
  return Boolean(getToken());
}

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // Nothing stored, so nothing to clear.
  }
}

/** The session is over (logout, or a 401): forget it and go to the login page. */
export function expireSession() {
  clearSession();
  window.location.hash = '#/login';
}
