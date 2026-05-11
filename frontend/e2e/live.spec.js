/**
 * Live smoke tests against the deployed Coolify instance.
 *
 * Run with: E2E_NO_SERVER=1 npx playwright test e2e/live.spec.js --config=playwright.live.config.js
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://crm.shadowmarket.in';
const API  = process.env.E2E_API_URL  || BASE;

test.describe('Swetha CRM — live deployment', () => {
  test('health endpoint returns 200 with healthy status', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'healthy');
    expect(body).toHaveProperty('timestamp');
  });

  test('api/info returns running', async ({ request }) => {
    const res = await request.get(`${API}/api/info`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'running');
  });

  test('auth/login validates required fields', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/auth/login`, {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body).toHaveProperty('detail');
    expect(JSON.stringify(body)).toMatch(/email|password/i);
  });

  test('voiceflow webhook requires signature header', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/voiceflow/webhook`, {
      data: { foo: 'bar' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty('detail');
    expect(body.detail.toLowerCase()).toContain('signature');
  });

  test('voiceflow webhook rejects bad signature', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/voiceflow/webhook`, {
      data: { session_id: 'test' },
      headers: {
        'Content-Type': 'application/json',
        'X-Voiceflow-Signature': 'definitely-wrong-signature',
      },
    });
    // 401 for invalid signature (could be 500 if VOICEFLOW_WEBHOOK_SECRET unset)
    expect([401, 500]).toContain(res.status());
  });

  test('voiceflow conversation list requires auth', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/voiceflow/leads/1/conversations`);
    expect([401, 403]).toContain(res.status());
  });

  test('homepage serves SPA HTML', async ({ page }) => {
    await page.goto(BASE);
    // SPA shell loaded
    await expect(page).toHaveTitle(/Swetha|CRM|Vite|React/i);
  });

  test('login page renders email and password fields', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    // wait for SPA to hydrate
    await page.waitForLoadState('networkidle');
    const email = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i));
    const password = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i));
    await expect(email.first()).toBeVisible({ timeout: 10_000 });
    await expect(password.first()).toBeVisible({ timeout: 10_000 });
  });

  test('login form rejects invalid credentials', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('networkidle');
    const email = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i)).first();
    const password = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i)).first();
    await email.fill('definitely-not-a-real-user@example.com');
    await password.fill('definitely-wrong-password');
    const submit = page.getByRole('button', { name: /sign in|log in|login/i }).first();
    await submit.click();
    // Either inline error or toast within 10s
    await expect(
      page.getByText(/invalid|incorrect|wrong|not found|unauthorized/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
