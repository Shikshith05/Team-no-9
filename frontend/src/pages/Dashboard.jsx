// Dashboard page: net worth total (PWM-F-030) and asset allocation (PWM-F-031).
// The historical trend chart (PWM-F-032, #17) will be added below these cards.
import { useCallback, useEffect, useState } from 'react';
import { fetchDashboard } from '../api/dashboard.js';
import NetWorthCard from '../components/NetWorthCard.jsx';
import AllocationChart from '../components/AllocationChart.jsx';

export default function Dashboard() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });

  const load = useCallback(() => {
    return fetchDashboard()
      .then((data) => setState({ status: 'ready', data, error: null }))
      .catch((error) => setState({ status: 'error', data: null, error }));
  }, []);

  // State starts as 'loading', so the first fetch needs no state reset.
  useEffect(() => {
    load();
  }, [load]);

  const retry = () => {
    setState({ status: 'loading', data: null, error: null });
    load();
  };

  return (
    <main className="page">
      <header className="page-header">
        <h1>Dashboard</h1>
        <p className="muted">Your wealth across real estate, gold, stocks and cash.</p>
      </header>

      {state.status === 'loading' && (
        <div className="dashboard-grid" aria-busy="true" aria-label="Loading dashboard">
          <div className="card skeleton" />
          <div className="card skeleton skeleton-tall" />
        </div>
      )}

      {state.status === 'error' && (
        <div className="card error-card" role="alert">
          <p>We couldn't load your dashboard. {state.error.message}</p>
          <button type="button" className="button" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <div className="dashboard-grid">
          <NetWorthCard
            netWorth={state.data.netWorth}
            asOf={state.data.asOf}
            hasStaleData={state.data.hasStaleData}
            classCount={state.data.allocation.length}
          />
          <AllocationChart
            allocation={state.data.allocation}
            netWorth={state.data.netWorth}
          />
        </div>
      )}
    </main>
  );
}
