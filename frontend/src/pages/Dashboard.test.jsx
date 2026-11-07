// @vitest-environment jsdom
// B11 (#61): the dashboard page against the real API's reply shapes (only fetch is
// replaced). PWM-F-030, PWM-F-031, PWM-F-032; TC-Dash-01, TC-Dash-02, TC-Dash-03.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard.jsx';

const SUMMARY = {
  netWorth: '10345000.00',
  currency: 'INR',
  asOf: '2026-11-07T04:30:00.000Z',
  hasStaleData: false,
  allocation: [
    { assetType: 'REAL_ESTATE', value: '8200000.00', percent: '79.27' },
    { assetType: 'STOCK', value: '1200000.00', percent: '11.60' },
    { assetType: 'GOLD', value: '645000.00', percent: '6.23' },
    { assetType: 'CASH', value: '300000.00', percent: '2.90' },
  ],
};

const trendReply = (range, points) => ({ range, currency: 'INR', points });
const TWO_POINTS = [
  { date: '2026-11-06', netWorth: '10000000.00' },
  { date: '2026-11-07', netWorth: '10345000.00' },
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

// Answers by URL, as the backend would.
function serve({ dashboard = () => json(SUMMARY), trend = (range) => json(trendReply(range, TWO_POINTS)) } = {}) {
  fetch.mockImplementation(async (path) => {
    const url = new URL(path, 'http://x');
    if (url.pathname === '/api/dashboard') return dashboard();
    if (url.pathname === '/api/dashboard/trend') return trend(url.searchParams.get('range'));
    if (url.pathname === '/api/alerts') return json({ success: true, data: [] });
    throw new Error(`Unexpected request: ${path}`);
  });
}

const requestedRanges = () =>
  fetch.mock.calls
    .map(([path]) => new URL(path, 'http://x'))
    .filter((url) => url.pathname === '/api/dashboard/trend')
    .map((url) => url.searchParams.get('range'));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('token', 'jwt');
  vi.stubGlobal('fetch', vi.fn());
  // jsdom has no layout, so the chart is given a width by hand.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Dashboard', () => {
  it('shows the total and the allocation from GET /api/dashboard', async () => {
    serve();
    render(<Dashboard />);

    const total = await screen.findByTestId('net-worth-value');
    expect(total.textContent).toBe('₹1,03,45,000.00');

    const legend = within(screen.getByTestId('allocation-legend'));
    expect(legend.getAllByRole('listitem')).toHaveLength(4);
    expect(legend.getByText('Real estate')).toBeTruthy();
    expect(legend.getByText('79.27%')).toBeTruthy();
    expect(legend.getByText('₹82,00,000.00')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Cash & bank 2.90%');
  });

  it('draws the trend, ending on the same figure as the total', async () => {
    serve();
    render(<Dashboard />);

    const chart = await screen.findByTestId('trend-chart');
    expect(chart.dataset.range).toBe('1Y');
    expect(chart.dataset.pointCount).toBe('2');
    expect(chart.dataset.lastValue).toBe(SUMMARY.netWorth);
    expect(screen.getByTestId('trend-change').textContent).toContain('₹3,45,000.00');
  });

  it('asks the API for each range the user selects', async () => {
    serve();
    render(<Dashboard />);
    await screen.findByTestId('trend-chart');

    const buttons = within(screen.getByRole('group', { name: 'Time range' }));
    for (const [label, id] of [['1M', '1M'], ['6M', '6M'], ['All', 'ALL'], ['1Y', '1Y']]) {
      fireEvent.click(buttons.getByRole('button', { name: label }));
      await waitFor(() => expect(screen.getByTestId('trend-chart').dataset.range).toBe(id));
    }
    expect(requestedRanges()).toEqual(expect.arrayContaining(['1M', '6M', '1Y', 'ALL']));
  });

  it('copes with an empty portfolio', async () => {
    serve({
      dashboard: () => json({ ...SUMMARY, netWorth: '0.00', allocation: [] }),
      trend: (range) => json(trendReply(range, [])),
    });
    render(<Dashboard />);

    expect((await screen.findByTestId('net-worth-value')).textContent).toBe('₹0.00');
    expect(screen.getByText('No assets added yet')).toBeTruthy();
    expect(screen.getByText('Add your first asset to see how your wealth is split.')).toBeTruthy();
    expect((await screen.findByTestId('trend-empty')).textContent).toContain('No history for this period yet');
    expect(screen.queryByTestId('trend-chart')).toBeNull();
  });

  it('explains a single point instead of drawing a line', async () => {
    serve({ trend: (range) => json(trendReply(range, [TWO_POINTS[1]])) });
    render(<Dashboard />);

    expect((await screen.findByTestId('trend-empty')).textContent).toContain('₹1,03,45,000.00');
  });

  it('flags stale prices', async () => {
    serve({ dashboard: () => json({ ...SUMMARY, hasStaleData: true }) });
    render(<Dashboard />);

    await screen.findByTestId('net-worth-value');
    expect(screen.getByText('Some prices outdated')).toBeTruthy();
  });

  it('shows an error with a retry when the summary fails', async () => {
    serve({ dashboard: () => json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.', fields: [] } }, 500) });
    render(<Dashboard />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Something went wrong.');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('still shows the saved price alerts (B12)', async () => {
    serve();
    render(<Dashboard />);

    expect(await screen.findByRole('heading', { name: 'Price alerts' })).toBeTruthy();
    expect(await screen.findByText('No saved alerts yet.')).toBeTruthy();
  });
});
