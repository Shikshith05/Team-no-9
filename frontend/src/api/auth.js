
import { apiFetch } from './http.js';
import { USE_MOCK } from './mock.js';
import { mockForgotPassword, mockResetPassword } from './mockAuth.js';
import { expireSession, hasSession, saveSession } from './session.js';

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

export async function requestPasswordReset(email) {
  if (USE_MOCK) return mockForgotPassword(email);

  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export async function resetPassword(token, newPassword) {
  if (USE_MOCK) return mockResetPassword(token, newPassword);

  return apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
  });
}
