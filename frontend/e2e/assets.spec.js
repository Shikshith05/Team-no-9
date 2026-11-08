// Manual real estate valuation (PWM-F-022, #12; TC-Val-03), using the mock store.
// Screens are reached by clicking links so the in-memory mock data survives
// between steps (a page.goto reloads the app and resets it).
import { expect, test } from '@playwright/test';
import { expectFitsScreen, WIDTHS } from './helpers.js';

const todayLabel = () =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(
    new Date(),
  );

const property = (page, name) => page.getByTestId('property').filter({ hasText: name });
const valuationPuts = (page) =>
  page.evaluate(() => window.pwmMock.calls.filter((c) => c.method === 'PUT' && c.path.includes('/valuation')).length);

async function openUpdateForm(page, name) {
  await page.goto('/#/assets');
  await page.getByRole('link', { name: `Update value of ${name}` }).click();
  await expect(page.getByRole('heading', { name: 'Update property value' })).toBeVisible();
  await expect(page.getByLabel('New estimated value (₹)')).toBeVisible();
}

test('Assets nav link opens the real estate list with value and last valued date', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Assets' }).click();
  await expect(page.getByRole('heading', { name: 'Assets', level: 1 })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Assets', exact: true }),
  ).toHaveAttribute('aria-current', 'page');

  await expect(page.getByTestId('property')).toHaveCount(2);
  const plot = property(page, 'Plot, Vijayanagar');
  await expect(plot).toContainText('Mysuru');
  await expect(plot).toContainText('₹17,00,000.00');
  await expect(plot).toContainText('12 Apr 2026');
  // B23: stocks, gold and cash are listed too, in their own sections.
  await expect(page.getByTestId('asset')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'RELIANCE', level: 3 })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^(Real estate|Stocks|Gold|Cash & bank) \(\d\)$/, level: 2 })).toHaveCount(4);
});

test('TC-Val-03: updating a value saves it with today\'s date, adds a history row and updates net worth', async ({ page }) => {
  await openUpdateForm(page, 'Plot, Vijayanagar');
  await page.getByLabel('New estimated value (₹)').fill('25,00,000');
  await expect(page.getByText('₹25,00,000.00 (₹25 L)')).toBeVisible();
  await page.getByRole('button', { name: 'Save new value' }).click();

  const saved = page.getByTestId('valuation-saved');
  await expect(saved).toContainText('New value saved');
  await expect(saved).toContainText('₹25,00,000.00');
  await expect(saved).toContainText(todayLabel());
  expect(await page.evaluate(() => window.pwmMock.calls.at(-1))).toEqual({
    method: 'PUT',
    path: '/api/assets/mock-re-2/valuation',
    body: { value: '2500000.00' },
  });

  // History: a new MANUAL row on top, the old values still there.
  await saved.getByRole('link', { name: 'View history' }).click();
  const rows = page.getByTestId('valuation-history').locator('tbody tr');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('₹25,00,000.00');
  await expect(rows.nth(0)).toContainText(todayLabel());
  await expect(rows.nth(0)).toContainText('Manual');
  await expect(rows.nth(0)).toContainText('+₹8,00,000.00');
  await expect(rows.nth(1)).toContainText('₹17,00,000.00');
  await expect(rows.nth(3)).toContainText('₹12,00,000.00');

  // The list shows the new value and date.
  await page.getByRole('link', { name: '← Back to assets' }).click();
  await expect(property(page, 'Plot, Vijayanagar')).toContainText('₹25,00,000.00');
  await expect(property(page, 'Plot, Vijayanagar')).toContainText(todayLabel());

  // Dashboard: 1,03,45,000 - 17,00,000 + 25,00,000 = 1,11,45,000.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByTestId('net-worth-value')).toHaveText('₹1,11,45,000.00');
  await expect(page.getByTestId('trend-chart')).toHaveAttribute('data-last-value', '11145000.00');
});

test('invalid values show an inline error and are never sent', async ({ page }) => {
  await openUpdateForm(page, 'Apartment, Whitefield');
  const input = page.getByLabel('New estimated value (₹)');
  const save = page.getByRole('button', { name: 'Save new value' });

  const cases = [
    ['', 'Enter the new value.'],
    ['-100', "The value can't be negative."],
    ['abc', 'Enter a number, like 8500000 or 85,00,000.50.'],
    ['12.345', 'Use at most 2 decimal places.'],
    ['99999999999', 'Enter a value no more than ₹1,000 crore.'],
  ];
  for (const [value, message] of cases) {
    await input.fill(value);
    await save.click();
    await expect(page.locator('#valuation-error')).toHaveText(message);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(input).toBeFocused();
  }
  expect(await valuationPuts(page)).toBe(0);

  // Fixing the value clears the error as you type.
  await input.fill('7000000');
  await expect(page.locator('#valuation-error')).toHaveCount(0);
});

test('another user\'s asset shows "You can\'t edit this asset" and none of its data', async ({ page }) => {
  await page.goto('/#/assets/mock-re-other-user/valuation');
  await expect(page.getByTestId('asset-forbidden')).toContainText("You can't edit this asset");
  await expect(page.getByLabel('New estimated value (₹)')).toHaveCount(0);

  await page.goto('/#/assets/mock-re-other-user/history');
  await expect(page.getByTestId('asset-forbidden')).toContainText("You can't view this asset");
  await expect(page.getByTestId('valuation-history')).toHaveCount(0);
});

test('a 403 from the save request is shown on the form', async ({ page }) => {
  await page.goto('/?mock=forbidden#/assets/mock-re-2/valuation');
  await page.getByLabel('New estimated value (₹)').fill('2500000');
  await page.getByRole('button', { name: 'Save new value' }).click();
  await expect(page.getByRole('alert')).toHaveText("You can't edit this asset.");
  await expect(page.getByTestId('valuation-saved')).toHaveCount(0);
});

test('server field errors (SAD error shape) appear on the field', async ({ page }) => {
  await page.goto('/?mock=invalid#/assets/mock-re-2/valuation');
  await page.getByLabel('New estimated value (₹)').fill('2500000');
  await page.getByRole('button', { name: 'Save new value' }).click();
  await expect(page.locator('#valuation-error')).toHaveText(
    'must be an amount from 0 to 10000000000.00 with at most 2 decimals',
  );
});

test('a missing property gives a clear 404 message', async ({ page }) => {
  await page.goto('/#/assets/no-such-asset/history');
  await expect(page.getByTestId('asset-not-found')).toContainText("We couldn't find this property");
});

test('a 401 on the assets screen asks the user to log in again', async ({ page }) => {
  await page.goto('/?mock=unauth#/assets');
  await expect(page.getByTestId('session-expired')).toContainText('Please log in again');
  await expect(page.getByTestId('property')).toHaveCount(0);
});

test('empty state when the user has no assets', async ({ page }) => {
  await page.goto('/?mock=empty#/assets');
  await expect(page.getByTestId('assets-empty')).toContainText('No assets yet');
});

// B23 (PWM-F-010 to PWM-F-014): add, edit and delete with the mock store.
test('add a gold asset, edit it, delete it; net worth follows', async ({ page }) => {
  await page.goto('/#/assets');
  await page.getByRole('button', { name: 'Add asset' }).click();
  await page.getByLabel('Asset type').selectOption('GOLD');
  await page.getByLabel('Form').selectOption('BAR');
  await page.getByLabel('Purity (karat)').fill('24');
  await page.getByLabel('Weight (grams)').fill('10');
  await page.getByLabel('Purchase price (₹)').fill('60,000');
  await page.getByLabel('Current value (₹)').fill('1,00,000');
  await page.getByRole('button', { name: 'Add asset' }).click();
  await expect(page.getByTestId('asset-status')).toHaveText('Gold asset added.');
  const bar = page.getByTestId('asset').filter({ hasText: 'Gold bar (24K)' });
  await expect(bar).toContainText('₹1,00,000.00');

  await bar.getByRole('button', { name: 'Edit Gold bar (24K)' }).click();
  await expect(page.getByLabel('Weight (grams)')).toHaveValue('10');
  await page.getByLabel('Current value (₹)').fill('2,00,000');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(bar).toContainText('₹2,00,000.00');

  // Dashboard: 1,03,45,000 + 2,00,000.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByTestId('net-worth-value')).toHaveText('₹1,05,45,000.00');

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Assets' }).click();
  await page.getByRole('button', { name: 'Delete Gold bar (24K)' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete Gold bar (24K)?' });
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('asset-status')).toHaveText('Gold bar (24K) was deleted.');
  await expect(page.getByTestId('asset').filter({ hasText: 'Gold bar (24K)' })).toHaveCount(0);

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByTestId('net-worth-value')).toHaveText('₹1,03,45,000.00');
});

for (const width of WIDTHS) {
  test(`add / edit form and delete dialog fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/assets');
    await expect(page.getByTestId('property')).toHaveCount(2);
    await expectFitsScreen(page);

    for (const type of ['REAL_ESTATE', 'GOLD', 'STOCK', 'CASH']) {
      if (type === 'REAL_ESTATE') await page.getByRole('button', { name: 'Add asset' }).click();
      await page.getByLabel('Asset type').selectOption(type);
      await page.getByRole('button', { name: 'Add asset' }).click(); // empty: shows every error
      await expect(page.locator('.field-error').first()).toBeVisible();
      await expectFitsScreen(page);
    }
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Edit RELIANCE' }).click();
    await expect(page.getByLabel('Ticker symbol')).toHaveValue('RELIANCE');
    await expectFitsScreen(page);
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Delete Apartment, Whitefield' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expectFitsScreen(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });
}

for (const width of WIDTHS) {
  test(`asset screens fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/assets');
    await expect(page.getByTestId('property')).toHaveCount(2);
    await expectFitsScreen(page);

    await page.getByRole('link', { name: 'Update value of Apartment, Whitefield' }).click();
    const input = page.getByLabel('New estimated value (₹)');
    await input.fill('abc');
    await page.getByRole('button', { name: 'Save new value' }).click();
    await expect(page.locator('#valuation-error')).toBeVisible();
    await expectFitsScreen(page);

    await input.fill('1,23,45,67,890.50');
    await page.getByRole('button', { name: 'Save new value' }).click();
    await expect(page.getByTestId('valuation-saved')).toBeVisible();
    await expectFitsScreen(page);

    await page.getByRole('link', { name: 'View history' }).click();
    await expect(page.getByTestId('valuation-history').locator('tbody tr')).toHaveCount(4);
    await expectFitsScreen(page);
  });
}
