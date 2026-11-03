const BASE_URL = import.meta.env.VITE_API_URL || '';

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login?expired=true';
    }
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Request failed with status ${response.status}`);
    }
    return data;
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response;
}
