const BASE_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(message, status = 500, errors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.statusCode = status;
    this.errors = errors;
  }
}

export function isUnauthorized(error) {
  return Boolean(
    error && (error.status === 401 || error.statusCode === 401 || error.message?.includes('401'))
  );
}

export function fieldErrors(error) {
  if (!error) return {};
  if (error.errors && typeof error.errors === 'object') return error.errors;
  if (error.fields && typeof error.fields === 'object') return error.fields;
  return {};
}

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token');

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
    localStorage.removeItem('token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login?expired=true';
    }
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(
        data.message || `Request failed with status ${response.status}`,
        response.status,
        data.errors || {}
      );
    }
    return data;
  }

  if (!response.ok) {
    throw new ApiError(`Request failed with status ${response.status}`, response.status);
  }

  return response;
}

export default { apiFetch, ApiError, isUnauthorized, fieldErrors };
