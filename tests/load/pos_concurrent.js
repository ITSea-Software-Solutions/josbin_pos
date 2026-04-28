/**
 * Josbin POS — k6 Load Test
 * Simulates 10 concurrent POS terminals processing sales simultaneously.
 *
 * Targets:
 *   - POST /api/auth/login          < 300ms p95
 *   - GET  /api/products/pos        < 200ms p95
 *   - POST /api/sales               < 200ms p95
 *   - POST /api/sales/{id}/void     < 200ms p95
 *   - POST /api/auth/refresh        < 150ms p95
 *
 * Run:
 *   k6 run --env BASE_URL=http://localhost tests/load/pos_concurrent.js
 *
 * Requirements: k6 >= 0.46  (https://k6.io)
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

// Pre-seeded test accounts — one per simulated POS terminal
// These must exist in the staging DB (see tests/load/seed_load_test.php)
const POS_ACCOUNTS = Array.from({ length: 10 }, (_, i) => ({
  email:    `loadtest_cashier_${i + 1}@josbin_pos.test`,
  password: 'LoadTest123!',
}));

// Pre-seeded product UUIDs from the test catalogue
const PRODUCT_IDS = __ENV.PRODUCT_IDS
  ? __ENV.PRODUCT_IDS.split(',')
  : ['__REPLACE_WITH_SEEDED_PRODUCT_UUID__'];

const STORE_ID = __ENV.STORE_ID || '__REPLACE_WITH_SEEDED_STORE_UUID__';

// ── Custom metrics ────────────────────────────────────────────────────────────

const loginDuration    = new Trend('josbin_pos_login_duration',    true);
const productsDuration = new Trend('josbin_pos_products_duration', true);
const saleDuration     = new Trend('josbin_pos_sale_duration',     true);
const refreshDuration  = new Trend('josbin_pos_refresh_duration',  true);
const errorRate        = new Rate('josbin_pos_errors');

// ── Test scenarios ────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // 10 concurrent POS terminals — constant load for 5 minutes
    pos_terminals: {
      executor:          'constant-vus',
      vus:               10,
      duration:          '5m',
      gracefulStop:      '30s',
    },

    // Spike: 50 VUs for 30s to simulate morning rush / shift start
    morning_rush: {
      executor:          'ramping-vus',
      startVUs:          0,
      stages: [
        { duration: '30s', target: 50 },
        { duration: '1m',  target: 50 },
        { duration: '30s', target: 0  },
      ],
      startTime:         '5m30s',
      gracefulRampDown:  '15s',
    },
  },

  thresholds: {
    // All requests must stay under 500ms p99
    http_req_duration:             ['p(99)<500'],

    // Specific endpoint thresholds
    josbin_pos_login_duration:        ['p(95)<300'],
    josbin_pos_products_duration:     ['p(95)<200'],
    josbin_pos_sale_duration:         ['p(95)<200'],
    josbin_pos_refresh_duration:      ['p(95)<150'],

    // Less than 1% error rate
    josbin_pos_errors:                ['rate<0.01'],
    http_req_failed:               ['rate<0.01'],
  },
};

// ── VU lifecycle ──────────────────────────────────────────────────────────────

export function setup() {
  // Verify the staging environment is reachable
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error(`Health check failed: ${res.status}. Is the server running at ${BASE_URL}?`);
  }
  console.log(`Load test target: ${BASE_URL} — health check OK`);
}

export default function () {
  // Each VU acts as a different cashier
  const account = POS_ACCOUNTS[(__VU - 1) % POS_ACCOUNTS.length];
  let token = null;

  // ── 1. Login ─────────────────────────────────────────────────────────────
  group('login', () => {
    const res = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ email: account.email, password: account.password }),
      { headers: { 'Content-Type': 'application/json' } }
    );

    loginDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);

    const ok = check(res, {
      'login 200': (r) => r.status === 200,
      'has token': (r) => !!r.json('token'),
    });

    if (ok) {
      token = res.json('token');
    } else {
      console.error(`Login failed for ${account.email}: ${res.status} ${res.body}`);
      return;
    }
  });

  if (!token) return;

  const authHeaders = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // ── 2. Load product catalogue ────────────────────────────────────────────
  group('load_products', () => {
    const res = http.get(
      `${BASE_URL}/api/products/pos?store_id=${STORE_ID}`,
      { headers: authHeaders }
    );

    productsDuration.add(res.timings.duration);
    errorRate.add(res.status !== 200);

    check(res, {
      'products 200':     (r) => r.status === 200,
      'has products':     (r) => Array.isArray(r.json('data')) && r.json('data').length > 0,
      'products < 200ms': (r) => r.timings.duration < 200,
    });
  });

  sleep(randomIntBetween(1, 3)); // cashier browses / serves customer

  // ── 3. Complete a sale ───────────────────────────────────────────────────
  let saleId = null;

  group('create_sale', () => {
    // Pick 1–4 random products
    const itemCount = randomIntBetween(1, 4);
    const items = Array.from({ length: itemCount }, () => {
      const productId = randomItem(PRODUCT_IDS);
      return {
        product_id:   productId,
        product_name: 'Load Test Product',
        unit_price:   randomIntBetween(5, 200),
        quantity:     randomIntBetween(1, 5),
        btw_rate:     10,
        btw_exempt:   false,
      };
    });

    const payload = {
      store_id:       STORE_ID,
      payment_method: randomItem(['cash', 'card']),
      cash_tendered:  500,
      source:         'pos',
      items,
    };

    const res = http.post(
      `${BASE_URL}/api/sales`,
      JSON.stringify(payload),
      { headers: authHeaders }
    );

    saleDuration.add(res.timings.duration);
    errorRate.add(res.status !== 201);

    check(res, {
      'sale 201':       (r) => r.status === 201,
      'has sale id':    (r) => !!r.json('data.id'),
      'has total':      (r) => !!r.json('data.total_srd'),
      'sale < 200ms':   (r) => r.timings.duration < 200,
    });

    if (res.status === 201) {
      saleId = res.json('data.id');
    }
  });

  sleep(randomIntBetween(2, 5)); // next customer

  // ── 4. Token refresh (simulates shift continuing past initial expiry) ─────
  // Only refresh on 20% of iterations to avoid hammering the endpoint
  if (Math.random() < 0.2) {
    group('token_refresh', () => {
      const res = http.post(
        `${BASE_URL}/api/auth/refresh`,
        null,
        { headers: authHeaders }
      );

      refreshDuration.add(res.timings.duration);
      errorRate.add(res.status !== 200);

      check(res, {
        'refresh 200':    (r) => r.status === 200,
        'has new token':  (r) => !!r.json('token'),
        'refresh < 150ms':(r) => r.timings.duration < 150,
      });

      if (res.status === 200) {
        token = res.json('token');
        authHeaders['Authorization'] = `Bearer ${token}`;
      }
    });
  }

  // ── 5. Void a sale (5% of transactions) ─────────────────────────────────
  if (saleId && Math.random() < 0.05) {
    group('void_sale', () => {
      const res = http.post(
        `${BASE_URL}/api/sales/${saleId}/void`,
        JSON.stringify({ void_reason: 'Load test void — customer changed mind' }),
        { headers: authHeaders }
      );

      errorRate.add(res.status !== 200);

      check(res, {
        'void 200': (r) => r.status === 200,
      });
    });
  }

  sleep(randomIntBetween(1, 2));
}

export function teardown() {
  console.log('Load test complete. Review k6 summary above for threshold results.');
}
