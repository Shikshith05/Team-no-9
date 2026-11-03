import { apiFetch } from './http';

export async function fetchDashboardSummary() {
  const res = await apiFetch('/api/assets/dashboard-summary');
  const data = res.data || res;

  return {
    netWorth: data.netWorth || data.totalValue || '0.00',
    currency: data.currency || 'INR',
    asOf: data.asOf || new Date().toISOString(),
    hasStaleData: Boolean(data.hasStaleData),
    allocation: Array.isArray(data.allocation) ? data.allocation : []
  };
}

export async function fetchDashboardTrend(range = '1M') {
  try {
    const res = await apiFetch(`/api/assets/dashboard-trend?range=${encodeURIComponent(range)}`);
    const data = res.data || res;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.status === 404) {
      return [];
    }
    throw err;
  }
}
