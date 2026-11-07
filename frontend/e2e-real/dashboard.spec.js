// The dashboard against the real backend and database, with no mocks (#61;
// PWM-F-030, PWM-F-031, PWM-F-032; TC-Dash-01, TC-Dash-02, TC-Dash-03).
// See playwright.real.config.js for how to run it.
import { expect, test } from '@playwright/test';

const PASSWORD = 'GreenTea2026x';

/** Registers a throwaway user through the API and opens the app logged in. */
async function logIn(page, request) {
  const email = `dash.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const registered = await request.post('/api/auth/register', { data: { name: 'Dash', email, password: PASSWORD } });
  expect(registered.status()).toBe(201);

  await page.goto('/#/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const token = await page.evaluate(() => localStorage.getItem('token'));
  return { Authorization: `Bearer ${token}` };
}

test('an empty portfolio shows the empty states and no crash', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await logIn(page, request);

  await expect(page.getByTestId('net-worth-value')).toHaveText('₹0.00');
  await expect(page.getByText('No assets added yet')).toBeVisible();
  await expect(page.getByText('Add your first asset to see how your wealth is split.')).toBeVisible();
  await expect(page.getByTestId('trend-empty')).toBeVisible();
  expect(errors).toEqual([]);
});

test('totals, allocation and every trend range come from the real API', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const headers = await logIn(page, request);

  for (const [assetName, assetType, value] of [
    ['Flat', 'REAL_ESTATE', '100.00'],
    ['Shares', 'STOCK', '100.00'],
    ['Coins', 'GOLD', '100.00'],
  ]) {
    const created = await request.post('/api/assets', { headers, data: { assetName, assetType, value } });
    expect(created.status()).toBe(201);
  }
  await page.reload();

  // TC-Dash-01 and TC-Dash-02.
  await expect(page.getByTestId('net-worth-value')).toHaveText('₹300.00');
  const legend = page.getByTestId('allocation-legend');
  await expect(legend.getByRole('listitem')).toHaveCount(3);
  await expect(legend.getByText('33.34%')).toBeVisible();
  await expect(legend.getByText('33.33%')).toHaveCount(2);

  // TC-Dash-03: every range answers. The history is one day old, so each one
  // explains that the line appears after the next daily point.
  const ranges = page.getByRole('group', { name: 'Time range' });
  for (const [label, id] of [['1M', '1M'], ['6M', '6M'], ['1Y', '1Y'], ['All', 'ALL']]) {
    const reply = page.waitForResponse((res) => res.url().endsWith(`/api/dashboard/trend?range=${id}`));
    await ranges.getByRole('button', { name: label, exact: true }).click();
    const body = await (await reply).json();
    expect(body.range).toBe(id);
    expect(body.points.at(-1).netWorth).toBe('300.00');
    await expect(page.getByTestId('trend-empty')).toContainText('₹300.00');
  }

  // A manual valuation changes the total and the trend's last point together.
  const list = await (await request.get('/api/assets?type=REAL_ESTATE', { headers })).json();
  const revalued = await request.put(`/api/assets/${list.items[0].id}/valuation`, { headers, data: { value: '400.00' } });
  expect(revalued.status()).toBe(200);
  await page.reload();
  await expect(page.getByTestId('net-worth-value')).toHaveText('₹600.00');
  await expect(page.getByTestId('trend-empty')).toContainText('₹600.00');

  // A deleted asset leaves the total (TC-Asset-01).
  await request.delete(`/api/assets/${list.items[0].id}`, { headers });
  await page.reload();
  await expect(page.getByTestId('net-worth-value')).toHaveText('₹200.00');
  await expect(legend.getByRole('listitem')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('price alerts still save on the dashboard (B12)', async ({ page, request }) => {
  await logIn(page, request);
  await expect(page.getByText('No saved alerts yet.')).toBeVisible();

  await page.getByLabel('Target price').fill('2500');
  await page.getByRole('button', { name: 'Save alert' }).click();

  await expect(page.getByTestId('saved-alerts')).toContainText('₹2,500.00');
  await page.reload();
  await expect(page.getByTestId('saved-alerts')).toContainText('₹2,500.00');
});
