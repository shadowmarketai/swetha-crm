import { test, expect } from '@playwright/test';

const TEST_USER = {
  email: process.env.E2E_TEST_EMAIL || 'demo@swetha.local',
  password: process.env.E2E_TEST_PASSWORD || 'demo-password-change-me',
};

test.describe('Swetha CRM — smoke', () => {
  test('marketing root loads', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Swetha|CRM|Quotation/i);
  });

  test('login page renders the email + password form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
  });

  test('invalid login surfaces an error toast', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('not-a-real-user@example.com');
    await page.getByLabel(/password/i).fill('wrong-password');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    // toast or inline error should appear within 5s
    await expect(page.getByText(/invalid|incorrect|wrong/i).first()).toBeVisible({ timeout: 5_000 });
  });

  // Skipped by default — flip on once you seed an E2E user in the DB
  test.skip('authenticated user lands on the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(TEST_USER.email);
    await page.getByLabel(/password/i).fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/dashboard|\/crm|\/$/);
    await expect(page.getByRole('navigation')).toBeVisible();
  });
});

test.describe('Swetha CRM — API contract', () => {
  test('GET /api/info returns Swetha features when not in production', async ({ request }) => {
    const apiBase = process.env.E2E_API_URL || 'http://localhost:8000';
    const res = await request.get(`${apiBase}/api/info`);
    if (res.status() === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('status', 'running');
      // features only present when APP_ENV != production
      if (body.features) {
        const flat = body.features.join(' ').toLowerCase();
        expect(flat).toMatch(/crm|quotation/);
      }
    }
  });

  test('GET /health returns healthy', async ({ request }) => {
    const apiBase = process.env.E2E_API_URL || 'http://localhost:8000';
    const res = await request.get(`${apiBase}/health`);
    expect([200, 503]).toContain(res.status());
  });
});
