import { apiFetch } from './http';

export async function fetchDashboardSummary() {
  const data = await apiFetch('/api/assets/dashboard-summary');
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
    const data = await apiFetch(`/api/assets/dashboard-trend?range=${encodeURIComponent(range)}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
