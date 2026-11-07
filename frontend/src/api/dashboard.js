// Dashboard data (PWM-F-030, PWM-F-031, PWM-F-032).
//
// Calls the real endpoints (backend/src/controllers/dashboardController.js).
// With VITE_USE_MOCK_API=true it uses mock data instead (see mock.js for the ?mock=
// preview states); change that data from the browser console with window.pwmMock
// (see mockAssets.js) to watch the dashboard refresh.

import { ApiError, apiFetch } from './http.js';
import { mockDelay, mockMode, requireMockSession, USE_MOCK } from './mock.js';
import { getMockAssets, MOCK_ASSETS_STALE, mockStore } from './mockAssets.js';
import { mockTrendPoints } from './mockTrend.js';
import { buildDashboard, computeNetWorth } from '../lib/dashboard.js';

if (USE_MOCK && typeof window !== 'undefined') {
  window.pwmMock = mockStore;
}

/**
 * GET /api/dashboard (SAD 4.3.3)
 * 200 {"netWorth":"10345000.00","currency":"INR","asOf":"2026-09-29T04:30:00Z",
 *      "hasStaleData":false,
 *      "allocation":[{"assetType":"REAL_ESTATE","value":"8200000.00","percent":"79.27"}, ...]}
 * 401 when not logged in.
 */
export async function fetchDashboard() {
  if (USE_MOCK) return mockDashboard();
  return apiFetch('/api/dashboard');
}

/**
 * GET /api/dashboard/trend?range=1M|6M|1Y|ALL  (PWM-F-032, TC-Dash-03)
 *
 * - Worked out from the valuations table for the logged-in user only; the user id
 *   comes from the token, never from the request.
 * - One point per day, oldest first. 1M / 6M / 1Y cover the same calendar day 1, 6
 *   or 12 months ago (clamped to month end, e.g. 31 Mar -> 28 Feb) up to today,
 *   both inclusive, in IST, starting no earlier than the user's first asset. ALL
 *   starts at that first asset.
 * - Today's point uses the assets' current values, so the last point matches
 *   netWorth from GET /api/dashboard.
 * - Money is a decimal string, as everywhere in the API.
 *
 * 200 {"range":"1M","currency":"INR",
 *      "points":[{"date":"2026-09-19","netWorth":"10123000.00"}, ...,
 *                {"date":"2026-10-19","netWorth":"10345000.00"}]}
 *     A user with no assets gets "points": [].
 * 400 VALIDATION_ERROR when range is not 1M, 6M, 1Y or ALL.
 * 401 when not logged in.
 */
export async function fetchTrend(range) {
  if (USE_MOCK) return mockTrend(range);
  return apiFetch(`/api/dashboard/trend?range=${encodeURIComponent(range)}`);
}

async function mockDashboard() {
  await mockDelay();
  requireMockSession();
  const mode = mockMode();
  if (mode === 'error') throw new ApiError(503, { message: 'Could not reach the server.' });
  if (mode === 'empty') return buildDashboard([]);
  return buildDashboard(mode === 'stale' ? MOCK_ASSETS_STALE : getMockAssets(), new Date().toISOString());
}

async function mockTrend(range) {
  await mockDelay();
  requireMockSession();
  const mode = mockMode();
  if (mode === 'trend-error') throw new ApiError(503, { message: 'Could not reach the server.' });
  const points =
    mode === 'empty' || mode === 'trend-empty' ? [] : mockTrendPoints(range, computeNetWorth(getMockAssets()));
  return { range, currency: 'INR', points };
}
