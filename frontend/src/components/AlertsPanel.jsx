// Saved price alerts for the logged-in user (B12, #69). Moved here unchanged in
// behaviour from the dashboard page, so that page can show the portfolio cards again.
import { useEffect, useState } from 'react';
import { apiFetch } from '../api/http.js';
import { formatINR } from '../lib/money.js';

export default function AlertsPanel() {
  const [alertLogs, setAlertLogs] = useState([]);
  const [savedAlerts, setSavedAlerts] = useState([]);
  const [assetType, setAssetType] = useState('stock');
  const [condition, setCondition] = useState('ABOVE');
  const [targetPrice, setTargetPrice] = useState('');
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [savingAlert, setSavingAlert] = useState(false);
  const [error, setError] = useState('');

  // Load saved alerts belonging to the logged-in user.
  useEffect(() => {
    let active = true;

    const loadAlerts = async () => {
      try {
        const result = await apiFetch('/api/alerts');

        if (active) {
          setSavedAlerts(result.data || []);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Could not load saved alerts. Please log in.');
        }
      } finally {
        if (active) {
          setLoadingAlerts(false);
        }
      }
    };

    loadAlerts();

    return () => {
      active = false;
    };
  }, []);

  // Save alert permanently for the logged-in user.
  const handleSaveAlert = async () => {
    setError('');

    const price = Number(targetPrice);

    if (!targetPrice || !Number.isFinite(price) || price <= 0) {
      setError('Enter a valid target price greater than zero.');
      return;
    }

    setSavingAlert(true);

    try {
      const result = await apiFetch('/api/alerts', {
        method: 'POST',
        body: {
          assetType,
          condition,
          targetPrice: price,
        },
      });

      setSavedAlerts((prev) => [result.data, ...prev]);

      setAlertLogs((prev) => [...prev, `Saved: ${assetType} ${condition} ${formatINR(price)}`]);

      setTargetPrice('');
    } catch (err) {
      setError(err.message || 'Could not save alert.');
    } finally {
      setSavingAlert(false);
    }
  };

  return (
    <section className="card alerts-panel" aria-labelledby="alerts-heading">
      <h2 id="alerts-heading" className="card-title">Price alerts</h2>

      <div className="alerts-form">
        <select
          className="input"
          aria-label="Asset"
          value={assetType}
          onChange={(e) => setAssetType(e.target.value)}
        >
          <option value="stock">Stock Portfolio</option>
          <option value="gold">Gold Holdings</option>
        </select>

        <select
          className="input"
          aria-label="Condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
        >
          <option value="ABOVE">Rises Above (&gt;=)</option>
          <option value="BELOW">Drops Below (&lt;=)</option>
        </select>

        <input
          className="input"
          type="number"
          min="0.01"
          step="0.01"
          aria-label="Target price"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
          placeholder="Target price"
        />

        <button type="button" className="button" onClick={handleSaveAlert} disabled={savingAlert}>
          {savingAlert ? 'Saving...' : 'Save alert'}
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <h3 className="alerts-subheading">Your saved alerts</h3>

      {loadingAlerts ? (
        <p className="muted">Loading saved alerts...</p>
      ) : savedAlerts.length === 0 ? (
        <p className="muted">No saved alerts yet.</p>
      ) : (
        <ul className="alerts-list" data-testid="saved-alerts">
          {savedAlerts.map((alert) => (
            <li key={alert.id}>
              {alert.assetType.toUpperCase()} — {alert.condition} {formatINR(alert.targetPrice)}
            </li>
          ))}
        </ul>
      )}

      {alertLogs.length > 0 && (
        <ul className="alerts-list muted small" aria-label="Recent activity">
          {alertLogs.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
