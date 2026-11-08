// B23 against the real backend and database, no mocks (PWM-F-010 to PWM-F-014,
// TC-Asset-01, TC-Dash-01): log in, add one asset of each type through the form,
// edit one, delete one, and watch the dashboard total follow.
// Start the backend and a frontend first; see playwright.real.config.js.
import { expect, test } from '@playwright/test';

const PASSWORD = 'GreenTea2026x';

async function logIn(page, request) {
  const email = `assets.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const registered = await request.post('/api/auth/register', { data: { name: 'Assets', email, password: PASSWORD } });
  expect(registered.status()).toBe(201);
  await page.goto('/#/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: /Dashboard/ })).toBeVisible();
}

async function addAsset(page, type, fields) {
  await page.getByRole('button', { name: 'Add asset' }).click();
  await page.getByLabel('Asset type').selectOption(type);
  for (const [label, value] of fields) {
    const input = page.getByLabel(label, { exact: true });
    if ((await input.evaluate((el) => el.tagName)) === 'SELECT') await input.selectOption(value);
    else await input.fill(value);
  }
  await page.getByRole('button', { name: 'Add asset' }).click();
  await expect(page.getByTestId('asset-status')).toContainText('asset added.');
}

const netWorth = (page) => page.getByTestId('net-worth-value');
const goTo = (page, name) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true }).click();

test('add each asset type, edit, delete; the dashboard total follows', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await logIn(page, request);
  await goTo(page, 'Assets');
  await expect(page.getByTestId('assets-empty')).toBeVisible();

  // Client-side validation: nothing is sent for an invalid gold purity.
  await page.getByRole('button', { name: 'Add asset' }).click();
  await page.getByLabel('Asset type').selectOption('GOLD');
  await page.getByLabel('Purity (karat)').fill('25');
  const posts = [];
  page.on('request', (r) => r.method() === 'POST' && r.url().endsWith('/api/assets') && posts.push(r));
  await page.getByRole('button', { name: 'Add asset' }).click();
  await expect(page.locator('#asset-purityKarat-error')).toHaveText('Enter a whole number of karats from 1 to 24.');
  expect(posts).toHaveLength(0);
  await page.getByRole('button', { name: 'Cancel' }).click();

  await addAsset(page, 'REAL_ESTATE', [
    ['Property name', 'Flat, Adyar'],
    ['Location', 'Chennai'],
    ['Purchase value (₹)', '65,00,000'],
    ['Purchase date', '2021-03-15'],
    ['Current estimated value (₹)', '82,00,000'],
  ]);
  await addAsset(page, 'GOLD', [
    ['Form', 'COIN'],
    ['Purity (karat)', '22'],
    ['Weight (grams)', '20'],
    ['Purchase price (₹)', '1,10,000'],
    ['Current value (₹)', '1,20,000'],
  ]);
  await addAsset(page, 'STOCK', [
    ['Ticker symbol', 'reliance'],
    ['Quantity', '10'],
    ['Average buy price (₹)', '2800'],
    ['Current value (₹)', '28,500'],
  ]);
  await addAsset(page, 'CASH', [
    ['Account label', 'Savings account'],
    ['Current balance (₹)', '1,50,000'],
  ]);

  await expect(page.getByTestId('property')).toHaveCount(1);
  await expect(page.getByTestId('asset')).toHaveCount(3);
  await expect(page.getByTestId('asset').filter({ hasText: 'Gold coin (22K)' })).toContainText('Coin · 22K · 20.000 g');
  await expect(page.getByTestId('asset').filter({ hasText: 'RELIANCE' })).toContainText('10 shares · NSE');

  // 82,00,000 + 1,20,000 + 28,500 + 1,50,000
  await goTo(page, 'Dashboard');
  await expect(netWorth(page)).toHaveText('₹84,98,500.00');

  // The API stored the values as the form sent them (upper-case ticker, default exchange).
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const headers = { Authorization: `Bearer ${token}` };
  const stored = await (await request.get('/api/assets?type=STOCK', { headers })).json();
  expect(stored.items[0]).toMatchObject({ ticker: 'RELIANCE', exchange: 'NSE', quantity: '10', averageBuyPrice: '2800.00' });

  // Edit: the form is prefilled; the cash balance goes up by 50,000.
  await goTo(page, 'Assets');
  await page.getByRole('button', { name: 'Edit Savings account' }).click();
  await expect(page.getByLabel('Account label')).toHaveValue('Savings account');
  await page.getByLabel('Current balance (₹)').fill('2,00,000');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('asset-status')).toHaveText('Savings account was updated.');
  await expect(page.getByTestId('asset').filter({ hasText: 'Savings account' })).toContainText('₹2,00,000.00');
  await goTo(page, 'Dashboard');
  await expect(netWorth(page)).toHaveText('₹85,48,500.00');

  // Delete: in-page confirmation, then the asset leaves the list and the total.
  await goTo(page, 'Assets');
  await page.getByRole('button', { name: 'Delete RELIANCE' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete RELIANCE?' });
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('asset-status')).toHaveText('RELIANCE was deleted.');
  await expect(page.getByTestId('asset').filter({ hasText: 'RELIANCE' })).toHaveCount(0);
  await goTo(page, 'Dashboard');
  await expect(netWorth(page)).toHaveText('₹85,20,000.00');

  // Soft delete: the row is gone from the API but not from the database (B22 tests check the row).
  const gone = await (await request.get('/api/assets?type=STOCK', { headers })).json();
  expect(gone.total).toBe(0);
  expect(errors).toEqual([]);
});
