// B24 against the real backend (PWM-F-003, TC-Auth-03, TC-Sec-03, PRJ-SR-005).
// There is no email service: outside production the backend writes the reset
// link to its console. Start the backend with its output in a file and pass the
// path, for example:
//   node src/app.js > backend.log 2>&1
//   E2E_BACKEND_LOG=../backend/backend.log npm run test:e2e:real
// Without E2E_BACKEND_LOG this test is skipped.
import fs from 'node:fs';
import { expect, test } from '@playwright/test';

const OLD_PASSWORD = 'GreenTea2026x';
const NEW_PASSWORD = 'BlueRiver2027y';
const LOG = process.env.E2E_BACKEND_LOG;

async function linkFromLog(userId) {
  const pattern = new RegExp(`Reset link for user ${userId} .*?(#/reset-password\\?token=[^\\s]+)`, 'g');
  let link;
  await expect
    .poll(() => {
      const matches = [...fs.readFileSync(LOG, 'utf8').matchAll(pattern)];
      link = matches.at(-1)?.[1];
      return Boolean(link);
    })
    .toBe(true);
  return link;
}

test('forgot password, reset by the link, old session ends, lockout cleared, link works once', async ({ page, request }) => {
  test.skip(!LOG, 'Set E2E_BACKEND_LOG to the backend console log to run this test.');

  const email = `reset.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
  const registered = await request.post('/api/auth/register', { data: { name: 'Reset', email, password: OLD_PASSWORD } });
  const userId = (await registered.json()).user.id;
  const oldSession = await (await request.post('/api/auth/login', { data: { email, password: OLD_PASSWORD } })).json();

  // Lock the account (PRJ-SR-005).
  for (let i = 0; i < 5; i++) {
    await request.post('/api/auth/login', { data: { email, password: 'WrongPassword99' } });
  }
  expect((await request.post('/api/auth/login', { data: { email, password: OLD_PASSWORD } })).status()).toBe(423);

  // An unknown email gets the same screen as a real one.
  await page.goto('/#/forgot-password');
  await page.getByLabel('Email').fill('nobody.here@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByTestId('reset-requested')).toContainText('If an account exists for that email');

  await page.getByRole('button', { name: 'Send another link' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByTestId('reset-requested')).toBeVisible();

  // The tokens above must be from an earlier second than the reset (iat has whole seconds).
  await page.waitForTimeout(1100);

  const link = await linkFromLog(userId);
  await page.goto(`/${link}`);
  await page.getByLabel('New password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm new password').fill('password123');
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page.locator('#new-password-error')).toHaveText('This password is too common. Choose another one.');

  await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Confirm new password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page.getByTestId('reset-done')).toBeVisible();

  // The session from before the reset no longer works (TC-Sec-03).
  const old = await request.get('/api/assets', { headers: { Authorization: `Bearer ${oldSession.token}` } });
  expect(old.status()).toBe(401);

  // The lock is cleared and the new password works in the UI.
  await page.getByRole('link', { name: 'Go to login' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: /Dashboard/ })).toBeVisible();

  // The same link a second time.
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await page.goto(`/${link}`);
  await page.getByLabel('New password', { exact: true }).fill('AnotherOne2028z');
  await page.getByLabel('Confirm new password').fill('AnotherOne2028z');
  await page.getByRole('button', { name: 'Reset password' }).click();
  await expect(page.getByTestId('reset-link-used')).toBeVisible();
});
