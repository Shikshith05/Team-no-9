// Dashboard page: net worth total (PWM-F-030), asset allocation (PWM-F-031) and
// the historical trend (PWM-F-032). Every card reloads when assets change and
// when the tab becomes visible again (see useApiResource).
import { useState } from 'react';
import { fetchDashboard, fetchTrend } from '../api/dashboard.js';
import { useApiResource } from '../lib/useApiResource.js';
import { DEFAULT_RANGE } from '../lib/trend.js';
import NetWorthCard from '../components/NetWorthCard.jsx';
import AllocationChart from '../components/AllocationChart.jsx';
import TrendChart from '../components/TrendChart.jsx';
import SessionExpired from '../components/SessionExpired.jsx';

export default function Dashboard() {
  const summary = useApiResource(fetchDashboard);
  const [range, setRange] = useState(DEFAULT_RANGE);
  const trend = useApiResource(fetchTrend, range);
  const unauthorized = summary.status === 'unauthorized' || trend.status === 'unauthorized';

  return (
    <main className="page">
      <header className="page-header">
        <h1 tabIndex={-1}>Dashboard</h1>
        <p className="muted">Your wealth across real estate, gold, stocks and cash.</p>
      </header>

      {unauthorized && <SessionExpired />}

      {!unauthorized && summary.status === 'loading' && (
        <div className="dashboard-grid" aria-busy="true" aria-label="Loading dashboard">
          <div className="card skeleton" />
          <div className="card skeleton skeleton-tall" />
        </div>
      )}

      {!unauthorized && summary.status === 'error' && (
        <div className="card error-card" role="alert">
          <p>We couldn't load your dashboard. {summary.error.message}</p>
          <button type="button" className="button" onClick={summary.retry}>
            Try again
          </button>
        </div>
      )}

      {!unauthorized && summary.status === 'ready' && (
        <div className="dashboard-grid">
          <NetWorthCard
            netWorth={summary.data.netWorth}
            asOf={summary.data.asOf}
            hasStaleData={summary.data.hasStaleData}
            classCount={summary.data.allocation.length}
          />
          <AllocationChart allocation={summary.data.allocation} netWorth={summary.data.netWorth} />
          <TrendChart range={range} onRangeChange={setRange} trend={trend} />
        </div>
      )}
    </main>
  );
}
