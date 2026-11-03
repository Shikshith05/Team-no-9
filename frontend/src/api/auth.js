import { apiFetch } from './http';

export async function login(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const token = data.token || (data.data && data.data.token);
  const user = data.user || (data.data && data.data.user);

  if (token) {
    localStorage.setItem('token', token);
    localStorage.setItem('auth_token', token);
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    }
  }
  return data;
}

export async function logout() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (err) {
    console.warn('Logout notification error:', err?.message);
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
}

export function getToken() {
  return localStorage.getItem('token') || localStorage.getItem('auth_token');
}

export function getCurrentUser() {
  const user = localStorage.getItem('auth_user');
  return user ? JSON.parse(user) : null;
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export async function requestPasswordReset(email) {
  return await apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token, newPassword) {
  return await apiFetch('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export const authApi = {
  login,
  logout,
  getToken,
  getCurrentUser,
  isAuthenticated,
  requestPasswordReset,
  resetPassword,
};

export default authApi;
