
import React, { useState, useEffect } from 'react';
import { apiFetch } from '../api/http.js';
import { refreshAssetValuations } from '../valuationWorker';
import { evaluatePriceAlerts } from '../alertService';

export default function Dashboard() {
  const [stockValuation, setStockValuation] = useState({ price: 0, isStale: false });
  const [goldValuation, setGoldValuation] = useState({ price: 0, isStale: false });
  const [alertLogs, setAlertLogs] = useState([]);
  const [savedAlerts, setSavedAlerts] = useState([]);
  const [assetType, setAssetType] = useState('stock');
  const [condition, setCondition] = useState('ABOVE');
  const [targetPrice, setTargetPrice] = useState('');
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [savingAlert, setSavingAlert] = useState(false);
  const [error, setError] = useState('');

  // Load alerts belonging to the logged-in user.
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
        if (active) setLoadingAlerts(false);
      }
    };

    loadAlerts();

    return () => {
      active = false;
    };
  }, []);

  // Keep the existing automatic stock and gold valuation updates.
  useEffect(() => {
    const handleUpdate = (type, price, isStale) => {
      if (type === 'stock') setStockValuation({ price, isStale });
      if (type === 'gold') setGoldValuation({ price, isStale });
    };

    const handleAlertTrigger = (type, currentPrice) => {
      evaluatePriceAlerts(type, currentPrice, (userId, assetId, breachedPrice) => {
        setAlertLogs((prev) => [
          ...prev,
          `🚨 ${assetId.toUpperCase()} hit target boundary price: $${breachedPrice}!`,
        ]);
      });
    };

    refreshAssetValuations(handleUpdate, handleAlertTrigger);

    const interval = setInterval(() => {
      refreshAssetValuations(handleUpdate, handleAlertTrigger);
    }, 30000);

    return () => clearInterval(interval);
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
      setAlertLogs((prev) => [
        ...prev,
        `⚙️ Saved: ${assetType} ${condition} $${price}`,
      ]);
      setTargetPrice('');
    } catch (err) {
      setError(err.message || 'Could not save alert.');
    } finally {
      setSavingAlert(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>📊 Financial Wealth Dashboard Summary Overview</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        <div style={{ padding: '20px', border: '1px solid #d0d7de', borderRadius: '8px', background: '#fff' }}>
          <h3>📈 Live Automated Stock Valuation</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>
            ${stockValuation.price.toFixed(2)}
          </p>
          {stockValuation.isStale ? (
            <span style={{ color: '#cf222e', background: '#ffe3e3', padding: '4px 10px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>
              ⚠️ STALE CACHE RECOVERED
            </span>
          ) : (
            <span style={{ color: '#1a7f37', background: '#dafbe1', padding: '4px 10px', borderRadius: '4px', fontSize: '14px' }}>
              🟢 Live Market Stream
            </span>
          )}
        </div>

        <div style={{ padding: '20px', border: '1px solid #d0d7de', borderRadius: '8px', background: '#fff' }}>
          <h3>✨ Live Automated Gold Valuation</h3>
          <p style={{ fontSize: '32px', fontWeight: 'bold', margin: '10px 0' }}>
            ${goldValuation.price.toFixed(2)}
          </p>
          {goldValuation.isStale ? (
            <span style={{ color: '#cf222e', background: '#ffe3e3', padding: '4px 10px', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold' }}>
              ⚠️ STALE CACHE RECOVERED
            </span>
          ) : (
            <span style={{ color: '#1a7f37', background: '#dafbe1', padding: '4px 10px', borderRadius: '4px', fontSize: '14px' }}>
              🟢 Live Market Stream
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: '24px', border: '1px solid #d0d7de', borderRadius: '8px', background: '#f6f8fa', marginBottom: '30px' }}>
        <h3>🔔 Configure Custom Valuation Alert Boundaries</h3>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={assetType} onChange={(e) => setAssetType(e.target.value)} style={{ padding: '8px', borderRadius: '4px' }}>
            <option value="stock">Stock Portfolio</option>
            <option value="gold">Gold Holdings</option>
          </select>

          <select value={condition} onChange={(e) => setCondition(e.target.value)} style={{ padding: '8px', borderRadius: '4px' }}>
            <option value="ABOVE">Rises Above (≥)</option>
            <option value="BELOW">Drops Below (≤)</option>
          </select>

          <input
            type="number"
            min="0.01"
            step="0.01"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            placeholder="Target Trigger Value"
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #d0d7de' }}
          />

          <button
            type="button"
            onClick={handleSaveAlert}
            disabled={savingAlert}
            style={{ padding: '8px 16px', background: '#1f883d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {savingAlert ? 'Saving...' : 'Save Threshold Rule'}
          </button>
        </div>

        {error && <p role="alert" style={{ color: '#cf222e' }}>{error}</p>}
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h3>💾 Your Saved Alerts</h3>

        {loadingAlerts ? (
          <p>Loading saved alerts...</p>
        ) : savedAlerts.length === 0 ? (
          <p>No saved alerts yet.</p>
        ) : (
          <ul>
            {savedAlerts.map((alert) => (
              <li key={alert.id}>
                {alert.assetType.toUpperCase()} — {alert.condition} ${Number(alert.targetPrice).toFixed(2)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h4>🛡️ Live System Activity Audit Trail Logs</h4>
        <div style={{ background: '#24292f', color: '#f6f8fa', padding: '15px', borderRadius: '6px', height: '140px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '13px' }}>
          {alertLogs.length === 0 ? (
            <div style={{ color: '#8c959f' }}>System initialized. Monitoring asset boundaries...</div>
          ) : (
            alertLogs.map((log, index) => (
              <div key={index} style={{ marginBottom: '4px' }}>{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
