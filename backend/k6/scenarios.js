// ═══════════════════════════════════════════════════════════════
// StockFlow Enterprise — k6 Load Testing Scenarios
// ═══════════════════════════════════════════════════════════════
// Run: k6 run --vus 10 --duration 60s k6/scenarios.js
//
// Measures:
//   - p95, p99 latency
//   - Throughput (req/s)
//   - Error rate
// ═══════════════════════════════════════════════════════════════

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';

// ── Custom metrics ─────────────────────────────────────────────
const loginDuration = new Trend('login_duration');
const createSaleDuration = new Trend('create_sale_duration');
const completeSaleDuration = new Trend('complete_sale_duration');
const inventoryLookupDuration = new Trend('inventory_lookup_duration');
const customerSearchDuration = new Trend('customer_search_duration');
const glPostingDuration = new Trend('gl_posting_duration');
const errorRate = new Rate('errors');

// ── Configuration ──────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api';
const DEFAULT_EMAIL = 'admin@stockflow.com';
const DEFAULT_PASSWORD = 'admin123';
const COMPANY_ID = __ENV.COMPANY_ID || '00000000-0000-0000-0000-000000000001';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 10 },   // Stay at 10 users
    { duration: '30s', target: 50 },  // Ramp up to 50 users
    { duration: '1m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.01'],
    login_duration: ['p(95)<2000'],
    create_sale_duration: ['p(95)<3000'],
    complete_sale_duration: ['p(95)<3000'],
    inventory_lookup_duration: ['p(95)<1000'],
    customer_search_duration: ['p(95)<1000'],
    gl_posting_duration: ['p(95)<3000'],
  },
};

// ── State ──────────────────────────────────────────────────────
const state = {
  token: '',
  saleId: '',
  productId: '',
  customerId: '',
  journalId: '',
};

// ── Setup ──────────────────────────────────────────────────────
export function setup() {
  // Login to get initial token and prepare test data
  const loginRes = http.post(`${BASE_URL}/auth/login`, {
    email: DEFAULT_EMAIL,
    password: DEFAULT_PASSWORD,
  });

  check(loginRes, {
    'setup: login successful': (r) => r.status === 200,
  });

  const token = loginRes.json('access_token') || '';

  // Fetch a product
  const productRes = http.get(`${BASE_URL}/products?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const products = productRes.json('items') || productRes.json('data') || [];
  const productId = products.length > 0 ? products[0].id : '';

  // Fetch a customer
  const customerRes = http.get(`${BASE_URL}/customers?limit=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const customers = customerRes.json('items') || customerRes.json('data') || [];
  const customerId = customers.length > 0 ? customers[0].id : '';

  return {
    token,
    productId,
    customerId,
  };
}

// ── Default VU function ────────────────────────────────────────
export default function (data) {
  const authHeaders = {
    headers: {
      Authorization: `Bearer ${data.token}`,
      'Content-Type': 'application/json',
    },
  };

  group('Login', function () {
    const start = Date.now();
    const res = http.post(`${BASE_URL}/auth/login`, {
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD,
    });
    loginDuration.add(Date.now() - start);

    const success = check(res, {
      'login: status 200': (r) => r.status === 200,
      'login: has token': (r) => r.json('access_token') !== undefined,
    });

    if (!success) {
      errorRate.add(1);
    }

    if (res.json('access_token')) {
      data.token = res.json('access_token');
    }
  });

  sleep(1);

  group('Inventory Lookup', function () {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/inventory/stock?limit=20&page=1`,
      authHeaders,
    );
    inventoryLookupDuration.add(Date.now() - start);

    const success = check(res, {
      'inventory: status 200': (r) => r.status === 200,
    });

    if (!success) {
      errorRate.add(1);
    }
  });

  sleep(1);

  group('Customer Search', function () {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/customers?search=test&limit=10`,
      authHeaders,
    );
    customerSearchDuration.add(Date.now() - start);

    const success = check(res, {
      'customer: status 200': (r) => r.status === 200,
    });

    if (!success) {
      errorRate.add(1);
    }
  });

  sleep(1);

  // Only create a sale if we have a product and customer
  if (data.productId && data.customerId) {
    group('Create Sale', function () {
      const payload = JSON.stringify({
        customerId: data.customerId,
        warehouseId: '00000000-0000-0000-0000-000000000001',
        items: [
          {
            productId: data.productId,
            quantity: 1,
            unitPrice: '100.00',
          },
        ],
        paymentMethod: 'CASH',
        paidAmount: '100.00',
      });

      const start = Date.now();
      const res = http.post(
        `${BASE_URL}/sales`,
        payload,
        authHeaders,
      );
      createSaleDuration.add(Date.now() - start);

      const success = check(res, {
        'create sale: status 201': (r) => r.status === 201,
        'create sale: has id': (r) => r.json('id') !== undefined,
      });

      if (!success) {
        errorRate.add(1);
      }

      const saleId = res.json('id') || '';
      if (saleId) {
        data.saleId = saleId;

        group('Complete Sale', function () {
          const start2 = Date.now();
          const res2 = http.post(
            `${BASE_URL}/sales/${saleId}/complete`,
            null,
            authHeaders,
          );
          completeSaleDuration.add(Date.now() - start2);

          const success2 = check(res2, {
            'complete sale: status 200': (r) => r.status === 200,
          });

          if (!success2) {
            errorRate.add(1);
          }
        });

        sleep(1);

        group('GL Posting', function () {
          const start3 = Date.now();
          const res3 = http.get(
            `${BASE_URL}/finance/journal-entries?limit=10`,
            authHeaders,
          );
          glPostingDuration.add(Date.now() - start3);

          const success3 = check(res3, {
            'gl journal: status 200': (r) => r.status === 200,
          });

          if (!success3) {
            errorRate.add(1);
          }
        });
      }
    });
  }

  sleep(2);
}

// ── Teardown ───────────────────────────────────────────────────
export function teardown(data) {
  if (data.saleId) {
    http.del(`${BASE_URL}/sales/${data.saleId}`, null, {
      headers: { Authorization: `Bearer ${data.token}` },
    });
  }
}
