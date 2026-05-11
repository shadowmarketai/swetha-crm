/**
 * Playwright config for live deployment smoke tests.
 * Does NOT spin up a local dev server — assumes the target URL is reachable.
 *
 * Run with: npx playwright test --config=playwright.live.config.js
 */
import { defineConfig, devices } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://crm.shadowmarket.in';

export default defineConfig({
  testDir: './e2e',
  testMatch: /live\.spec\.js$/,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 1,
  reporter: 'list',

  use: {
    baseURL: BASE,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
