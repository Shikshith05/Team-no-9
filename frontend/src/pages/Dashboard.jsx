
import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/http.js';

export default function Dashboard() {
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
          targetPrice: price
        }
      });

      setSavedAlerts((prev) => [result.data, ...prev]);

      setAlertLogs((prev) => [
        ...prev,
        `Saved: ${assetType} ${condition} $${price}`
      ]);

      setTargetPrice('');
    } catch (err) {
      setError(err.message || 'Could not save alert.');
    } finally {
      setSavingAlert(false);
    }
  };

  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '1000px',
        margin: '0 auto',
        fontFamily: 'sans-serif'
      }}
    >
      <h2>Financial Wealth Dashboard</h2>

      <div
        style={{
          padding: '24px',
          border: '1px solid #d0d7de',
          borderRadius: '8px',
          background: '#f6f8fa',
          marginBottom: '30px'
        }}
      >
        <h3>Configure Custom Valuation Alert Boundaries</h3>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}
        >
          <select
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px' }}
          >
            <option value="stock">Stock Portfolio</option>
            <option value="gold">Gold Holdings</option>
          </select>

          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px' }}
          >
            <option value="ABOVE">Rises Above (&gt;=)</option>
            <option value="BELOW">Drops Below (&lt;=)</option>
          </select>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder="Target Trigger Value"
            style={{
              padding: '8px',
              border: '1px solid #d0d7de',
              borderRadius: '4px'
            }}
          />

          <button
            type="button"
            onClick={handleSaveAlert}
            disabled={savingAlert}
            style={{
              padding: '8px 16px',
              background: '#1f883d',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {savingAlert ? 'Saving...' : 'Save Threshold Rule'}
          </button>
        </div>

        {error && (
          <p role="alert" style={{ color: '#cf222e' }}>
            {error}
          </p>
        )}
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h3>Your Saved Alerts</h3>

        {loadingAlerts ? (
          <p>Loading saved alerts...</p>
        ) : savedAlerts.length === 0 ? (
          <p>No saved alerts yet.</p>
        ) : (
          <ul>
            {savedAlerts.map((alert) => (
              <li key={alert.id}>
                {alert.assetType.toUpperCase()} — {alert.condition}{' '}
                ${Number(alert.targetPrice).toFixed(2)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4>System Activity Logs</h4>

        <div
          style={{
            background: '#24292f',
            color: '#f6f8fa',
            padding: '15px',
            borderRadius: '6px',
            height: '140px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '13px'
          }}
        >
          {alertLogs.length === 0 ? (
            <div style={{ color: '#8c959f' }}>
              System initialized. Configure your valuation alerts.
            </div>
          ) : (
            alertLogs.map((log, index) => (
              <div key={index} style={{ marginBottom: '4px' }}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
