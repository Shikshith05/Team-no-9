
import { apiFetch } from './http.js';
import { USE_MOCK } from './mock.js';
import { mockForgotPassword, mockResetPassword } from './mockAuth.js';
import { clearSession, expireSession, hasSession, saveSession } from './session.js';

export async function register(name, email, password) {
  if (USE_MOCK) {
    throw new Error('Registration requires the real API.');
  }

  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });
}

export async function login(email, password) {
  if (USE_MOCK) {
    throw new Error('Login needs the real API. Unset VITE_USE_MOCK_API.');
  }

  const result = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  if (!result?.token || !result?.user) {
    throw new Error('Login response did not contain a valid token and user.');
  }

  saveSession(result.token, result.user);

  return result;
}

// PRJ-SR-003: the server revokes the token. The user is logged out of this
// browser even if that call fails (for example, offline); the token then simply
// expires on its own.
export async function logout() {
  try {
    if (hasSession()) {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    }
  } catch (error) {
    console.warn('Logout could not reach the server:', error.message);
  } finally {
    expireSession();
  }
}

// B24 (PWM-F-003). POST /api/auth/forgot-password {email} -> 202 whether or not
// the account exists (SAD 4.3.4) | 400 VALIDATION_ERROR (email format).
export async function requestPasswordReset(email) {
  if (USE_MOCK) return mockForgotPassword(email);

  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

// POST /api/auth/reset-password {token, password} -> 200
// 400 RESET_TOKEN_INVALID | RESET_TOKEN_EXPIRED | RESET_TOKEN_USED, or
// 400 VALIDATION_ERROR with a "password" field error (registration policy).
// A reset ends every session of the account (users.token_valid_after), so this
// browser's stored session is dropped too.
export async function resetPassword(token, password) {
  if (USE_MOCK) return mockResetPassword(token, password);

  const result = await apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: { token, password },
  });
  clearSession();
  return result;
}
