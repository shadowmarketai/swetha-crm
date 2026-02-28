/**
 * VoiceFlow AI — k6 Load Test Suite
 *
 * Install: https://k6.io/docs/getting-started/installation/
 *
 * Run scenarios:
 *   k6 run --env SCENARIO=smoke   tests/load/k6-load-test.js
 *   k6 run --env SCENARIO=load    tests/load/k6-load-test.js
 *   k6 run --env SCENARIO=stress  tests/load/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const apiDuration = new Trend('api_duration');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const SCENARIO = __ENV.SCENARIO || 'smoke';

const scenarios = {
  smoke: {
    vus: 2,
    duration: '30s',
    thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<500'] },
  },
  load: {
    stages: [
      { duration: '1m', target: 20 },   // Ramp up
      { duration: '3m', target: 20 },   // Steady state
      { duration: '1m', target: 50 },   // Peak
      { duration: '2m', target: 50 },   // Sustained peak
      { duration: '1m', target: 0 },    // Ramp down
    ],
    thresholds: { http_req_failed: ['rate<0.05'], http_req_duration: ['p(95)<1000'] },
  },
  stress: {
    stages: [
      { duration: '1m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '1m', target: 0 },
    ],
    thresholds: { http_req_failed: ['rate<0.10'], http_req_duration: ['p(95)<2000'] },
  },
};

const config = scenarios[SCENARIO];

export const options = {
  vus: config.vus,
  duration: config.duration,
  stages: config.stages,
  thresholds: {
    ...config.thresholds,
    errors: ['rate<0.1'],
  },
};

// Login and get token
function getAuthToken() {
  const res = http.post(`${BASE_URL}/api/v1/auth/login`, JSON.stringify({
    email: 'admin@shadowmarket.ai',
    password: 'admin123',
  }), { headers: { 'Content-Type': 'application/json' } });

  loginDuration.add(res.timings.duration);

  if (res.status === 200) {
    const body = JSON.parse(res.body);
    return body.access_token || body.token || 'demo-token-123';
  }
  return 'demo-token-123';
}

export default function () {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Health check
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, { 'health OK': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
  });

  sleep(0.5);

  // Dashboard KPIs
  group('Dashboard', () => {
    const res = http.get(`${BASE_URL}/api/v1/analytics/dashboard`, { headers });
    check(res, { 'dashboard OK': (r) => r.status === 200 });
    apiDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);
  });

  sleep(0.3);

  // List leads
  group('Leads', () => {
    const res = http.get(`${BASE_URL}/api/v1/leads?page=1&per_page=20`, { headers });
    check(res, { 'leads OK': (r) => r.status === 200 });
    apiDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);
  });

  sleep(0.3);

  // List calls
  group('Calls', () => {
    const res = http.get(`${BASE_URL}/api/v1/calls?page=1&per_page=20`, { headers });
    check(res, { 'calls OK': (r) => r.status === 200 });
    apiDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);
  });

  sleep(0.3);

  // List campaigns
  group('Campaigns', () => {
    const res = http.get(`${BASE_URL}/api/v1/campaigns`, { headers });
    check(res, { 'campaigns OK': (r) => r.status === 200 });
    apiDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);
  });

  sleep(0.3);

  // Feature flags
  group('Feature Flags', () => {
    const res = http.get(`${BASE_URL}/api/v1/features`, { headers });
    check(res, { 'features OK': (r) => r.status === 200 });
    apiDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);
  });

  sleep(0.5);

  // Create + delete a lead (write test)
  group('Lead CRUD', () => {
    const createRes = http.post(`${BASE_URL}/api/v1/leads`, JSON.stringify({
      name: `K6 Test Lead ${Date.now()}`,
      email: `k6-${Date.now()}@test.com`,
      phone: '+91 9999900000',
      company: 'K6 Load Test',
      source: 'Load Test',
      status: 'cold',
    }), { headers });

    check(createRes, { 'lead created': (r) => r.status === 200 || r.status === 201 });
    apiDuration.add(createRes.timings.duration);

    if (createRes.status === 200 || createRes.status === 201) {
      try {
        const lead = JSON.parse(createRes.body);
        if (lead.id) {
          const delRes = http.del(`${BASE_URL}/api/v1/leads/${lead.id}`, null, { headers });
          check(delRes, { 'lead deleted': (r) => r.status === 200 });
        }
      } catch (e) { /* ignore parse errors */ }
    }
  });

  sleep(1);
}
