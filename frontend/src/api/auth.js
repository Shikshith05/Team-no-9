
import { apiFetch } from './http.js';
import { USE_MOCK } from './mock.js';
import { mockForgotPassword, mockResetPassword } from './mockAuth.js';

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
    throw new Error('Real login requires VITE_USE_MOCK_API=false.');
  }

  const result = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  if (!result?.token || !result?.user) {
    throw new Error('Login response did not contain a valid token and user.');
  }

  localStorage.setItem('token', result.token);
  localStorage.setItem('user', JSON.stringify(result.user));

  return result;
}

export async function logout() {
  const token = localStorage.getItem('token');

  try {
    if (token) {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    }
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.hash = '#/login';
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
