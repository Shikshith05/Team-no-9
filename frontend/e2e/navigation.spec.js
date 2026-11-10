// B27: the unbuilt Settings placeholder is gone. Settings belong to the Admin
// module (SRS 2.3, SAD 4.8), which is not implemented.
import { expect, test } from '@playwright/test';

test('the main navigation shows only Dashboard, Assets and Reports', async ({ page }) => {
  await page.goto('/#/');
  const links = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
  await expect(links).toHaveText(['Dashboard', 'Assets', 'Reports']);
});

test('#/settings is handled like any other unknown route', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByText("This screen isn't built yet")).toHaveCount(0);

  await page.goto('/#/no-such-page');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});
