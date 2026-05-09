import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.E2E_PORT || 3000;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
  ],

  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: `npm run dev -- --port ${PORT}`,
        port: Number(PORT),
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
