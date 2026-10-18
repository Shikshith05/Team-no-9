// Sample portfolio used until the backend asset APIs (Sateesh's issues) are merged.
// Totals match the example GET /api/dashboard response in SAD 4.3.3:
// net worth ₹1,03,45,000 = real estate 82,00,000 + stocks 12,00,000
//                          + gold 6,45,000 + cash 3,00,000.

export const MOCK_ASSETS = [
  { id: 'mock-re-1', assetType: 'REAL_ESTATE', name: 'Apartment, Whitefield', currentValue: '6500000.00' },
  { id: 'mock-re-2', assetType: 'REAL_ESTATE', name: 'Plot, Mysuru', currentValue: '1700000.00' },
  { id: 'mock-st-1', assetType: 'STOCK', name: 'RELIANCE', currentValue: '712500.00', isStale: false },
  { id: 'mock-st-2', assetType: 'STOCK', name: 'INFY', currentValue: '487500.00', isStale: false },
  { id: 'mock-gd-1', assetType: 'GOLD', name: 'Gold coins 24K', currentValue: '420000.00', isStale: false },
  { id: 'mock-gd-2', assetType: 'GOLD', name: 'Jewellery 22K', currentValue: '225000.00', isStale: false },
  { id: 'mock-ca-1', assetType: 'CASH', name: 'Savings account', currentValue: '250000.00' },
  { id: 'mock-ca-2', assetType: 'CASH', name: 'Wallet', currentValue: '50000.00' },
  // Deleted assets must not count toward net worth (TC-Dash-01).
  { id: 'mock-ca-3', assetType: 'CASH', name: 'Closed account', currentValue: '99999.00', deletedAt: '2026-10-01T00:00:00Z' },
];

/** Same portfolio but with one stock price flagged stale, to preview the stale badge. */
export const MOCK_ASSETS_STALE = MOCK_ASSETS.map((a) =>
  a.id === 'mock-st-2' ? { ...a, isStale: true } : a,
);
