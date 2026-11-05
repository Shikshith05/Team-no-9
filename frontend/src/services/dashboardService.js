import { apiFetch } from "./http";

export async function getDashboardSummary() {
  const data = await apiFetch("/api/assets/dashboard-summary", {
    method: "GET",
  });
  return {
    ...data,
    totalNetWorth: data?.totalNetWorth ?? data?.netWorth ?? data?.totalValue ?? 0,
    netWorth: data?.totalNetWorth ?? data?.netWorth ?? data?.totalValue ?? 0,
  };
}

export async function getDashboardTrend() {
  try {
    return await apiFetch("/api/assets/dashboard-trend", {
      method: "GET",
    });
  } catch (err) {
    // Catch 404 until historical trend endpoint is implemented in backend
    return { trend: [] };
  }
}
