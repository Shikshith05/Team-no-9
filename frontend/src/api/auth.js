import { apiFetch } from './http';

export const authApi = {
  async login(email, password) {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.token) {
      localStorage.setItem('auth_token', data.token);
      if (data.user) {
        localStorage.setItem('auth_user', JSON.stringify(data.user));
      }
    }
    return data;
  },

  async logout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Backend logout call skipped/failed:', err.message);
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
  },

  getToken() {
    return localStorage.getItem('auth_token');
  },

  getCurrentUser() {
    const user = localStorage.getItem('auth_user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated() {
    return !!localStorage.getItem('auth_token');
  }
};
