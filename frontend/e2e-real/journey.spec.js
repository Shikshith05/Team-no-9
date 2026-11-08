// End-to-end journey against the real backend and database, with no mocks
// (#59, #60; PWM-F-001, PWM-F-002, PWM-F-033, PRJ-SR-003, PRJ-SR-005).
// Start the backend and a frontend first; see playwright.real.config.js.
// Each run registers its own throwaway users.
import { expect, test } from '@playwright/test';

const PASSWORD = 'GreenTea2026x';

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function registerInUi(page, email, password = PASSWORD) {
  await page.goto('/#/register');
  await page.getByLabel('Full name').fill('Journey Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
}

async function logInUi(page, email, password = PASSWORD) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

const storedToken = (page) => page.evaluate(() => localStorage.getItem('token'));

test('register, log in, use the app, export, log out', async ({ page, request }) => {
  const email = uniqueEmail('journey');

  // Register, then the app sends the user to the login page.
  await registerInUi(page, email);
  await expect(page.getByRole('status')).toContainText('Account created');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();

  // Log in: token stored under the single key, dashboard shown.
  await logInUi(page, email);
  await expect(page.getByRole('heading', { name: /Dashboard/ })).toBeVisible();
  const token = await storedToken(page);
  expect(token).toBeTruthy();
  expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBeNull();

  // Assets created through the API show up on the Assets screen.
  const headers = { Authorization: `Bearer ${token}` };
  const created = await request.post('/api/assets', {
    headers,
    data: { assetName: 'Flat, Adyar', assetType: 'REAL_ESTATE', value: '8200000.00', purchaseDate: '2021-03-15' },
  });
  expect(created.status()).toBe(201);
  await page.getByRole('link', { name: 'Assets', exact: true }).click();
  await expect(page.getByText('Flat, Adyar').first()).toBeVisible();

  // Reports: both exports download through the shared auth helper.
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  for (const [button, file] of [
    ['Download CSV', 'personal-wealth-report.csv'],
    ['Download PDF', 'personal-wealth-report.pdf'],
  ]) {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: button }).click();
    expect((await download).suggestedFilename()).toBe(file);
  }
  await expect(page.getByRole('status')).toContainText('downloaded successfully');

  // Logout: revoked on the server, cleared in the browser, back at login.
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  expect(page.url()).toContain('#/login');
  expect(await storedToken(page)).toBeNull();
  const revoked = await request.get('/api/assets', { headers });
  expect(revoked.status()).toBe(401);

  // A protected page now redirects to login.
  await page.goto('/#/reports');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  expect(page.url()).toContain('#/login');

  // Logging straight back in works, even within the same second as the logout.
  await logInUi(page, email);
  await expect(page.getByRole('heading', { name: /Dashboard/ })).toBeVisible();
  const again = await request.get('/api/assets', { headers: { Authorization: `Bearer ${await storedToken(page)}` } });
  expect(again.status()).toBe(200);
});

test('a 401 on any screen clears the session and goes to login', async ({ page }) => {
  const email = uniqueEmail('expired');
  await registerInUi(page, email);
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await logInUi(page, email);
  await expect(page.getByRole('heading', { name: /Dashboard/ })).toBeVisible();

  for (const screen of ['#/assets', '#/']) {
    await page.evaluate(() => localStorage.setItem('token', 'not.a.valid-token'));
    await page.evaluate((hash) => {
      window.location.hash = hash;
    }, screen);
    await page.reload(); // the hash may not have changed, so make the screen load again
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
    expect(page.url()).toContain('#/login');
    expect(await storedToken(page)).toBeNull();

    await logInUi(page, email);
    await expect(page.getByRole('heading', { name: /Dashboard/ })).toBeVisible();
  }

  // Reports makes its request on a click, not on load.
  await page.evaluate(() => {
    window.location.hash = '#/reports';
  });
  await page.evaluate(() => localStorage.setItem('token', 'not.a.valid-token'));
  await page.getByRole('button', { name: 'Download CSV' }).click();
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  expect(await storedToken(page)).toBeNull();
});

test('login shows the backend messages: invalid credentials, then locked with a retry time', async ({ page }) => {
  const email = uniqueEmail('locked');
  await registerInUi(page, email);
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();

  const alert = page.getByRole('alert');
  for (let attempt = 1; attempt <= 5; attempt++) {
    await logInUi(page, email, `WrongPass${attempt}2345`);
    await expect(alert).toHaveText('Invalid email or password.');
    await expect(page.getByRole('button', { name: 'Log in' })).toBeEnabled();
  }

  // PRJ-SR-005: the 6th attempt is blocked, even with the right password.
  await logInUi(page, email);
  await expect(alert).toContainText('Account locked');
  await expect(alert).toContainText('15 minutes');
  expect(await storedToken(page)).toBeNull();
});

test('register shows the backend field errors', async ({ page }) => {
  const email = uniqueEmail('dupe');
  await registerInUi(page, email, 'short1');
  await expect(page.locator('#register-password-error')).toContainText('at least 10 characters');

  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();

  await registerInUi(page, email);
  await expect(page.locator('#register-email-error')).toHaveText('Email is already registered.');
});
