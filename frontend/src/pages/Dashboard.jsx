
import React, { useState } from 'react';
import { configureAlertThreshold } from '../alertService';

export default function Dashboard() {
  const [alertLogs, setAlertLogs] = useState([]);

  const [assetType, setAssetType] = useState('stock');
  const [condition, setCondition] = useState('ABOVE');
  const [targetPrice, setTargetPrice] = useState('');

  const handleSaveAlert = () => {
    if (!targetPrice || parseFloat(targetPrice) <= 0) return;

    configureAlertThreshold(
      'user_01',
      assetType,
      parseFloat(targetPrice),
      condition
    );

    setAlertLogs(prev => [
      ...prev,
      `Threshold Saved: ${assetType} ${condition} $${targetPrice}`
    ]);

    setTargetPrice('');
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
        <h3>Configure Custom Valuation Alerts</h3>

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
            onChange={e => setAssetType(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px' }}
          >
            <option value="stock">Stock Portfolio</option>
            <option value="gold">Gold Holdings</option>
          </select>

          <select
            value={condition}
            onChange={e => setCondition(e.target.value)}
            style={{ padding: '8px', borderRadius: '4px' }}
          >
            <option value="ABOVE">Rises Above (≥)</option>
            <option value="BELOW">Drops Below (≤)</option>
          </select>

          <input
            type="number"
            value={targetPrice}
            onChange={e => setTargetPrice(e.target.value)}
            placeholder="Target Trigger Value"
            style={{
              padding: '8px',
              border: '1px solid #d0d7de',
              borderRadius: '4px'
            }}
          />

          <button
            onClick={handleSaveAlert}
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
            Save Threshold Rule
          </button>
        </div>
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
