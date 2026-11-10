// Browser journey against the real backend (no mocks). Nothing is started for you:
//   1. start the backend on port 5000 (cd backend && npm run dev)
//   2. start the frontend (cd frontend && npm run dev)
//   3. npm run test:e2e:real
// To run it through the Docker gateway instead:
//   E2E_BASE_URL=https://localhost npm run test:e2e:real
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e-real',
  reporter: 'list',
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    // The development gateway uses a self-signed certificate.
    ignoreHTTPSErrors: true,
    ...devices['Desktop Chrome'],
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
});
