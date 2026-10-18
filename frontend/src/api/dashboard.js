// Dashboard data source.
//
// By default this uses mock data, because the backend asset and dashboard APIs
// are not built yet. Once GET /api/dashboard exists, set VITE_USE_MOCK_API=false
// in frontend/.env.local (or remove the mock branch) and the real endpoint is
// used with no other changes; the response shape follows SAD 4.3.3.
//
// While on mock data you can preview other states with a URL parameter:
//   ?mock=stale   one stock price flagged stale
//   ?mock=empty   a user with no assets yet
//   ?mock=error   the request fails
// and change the sample data from the browser console with window.pwmMock
// (see mockAssets.js) to watch the dashboard refresh.

import { buildDashboard } from '../lib/dashboard.js';
import { getMockAssets, MOCK_ASSETS_STALE, mockStore } from './mockAssets.js';

const USE_MOCK = import.meta.env.VITE_USE_MOCK_API !== 'false';

if (USE_MOCK && typeof window !== 'undefined') {
  window.pwmMock = mockStore;
}

export async function fetchDashboard() {
  if (USE_MOCK) return mockDashboard();

  const res = await fetch('/api/dashboard', { credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const error = new Error(body?.error?.message ?? `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

async function mockDashboard() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const mode = new URLSearchParams(window.location.search).get('mock');
  if (mode === 'error') throw new Error('Could not reach the server.');
  if (mode === 'empty') return buildDashboard([]);
  return buildDashboard(mode === 'stale' ? MOCK_ASSETS_STALE : getMockAssets(), new Date().toISOString());
}
