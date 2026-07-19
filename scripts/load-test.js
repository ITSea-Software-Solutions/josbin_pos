// =============================================================================
// Josbin POS — load test (k6)
//
// Models the contract's Phase-4 performance target:
//   - 10 concurrent POS terminals ringing up cash sales with realistic
//     think-time (≈ 1 000+ sales/day/store pace per till)
//   - a 50-VU read burst (catalogue + store payload) approximating 50 stores
//     pulling data simultaneously
//   - budget: p95 < 200 ms per request, error rate < 1 %
//
// Run against the LOCAL DEMO stack (never production):
//   k6 run scripts/load-test.js                      # default http://localhost:8082
//   k6 run -e BASE=http://host:port scripts/load-test.js
//
// Uses the seeded demo cashier. Sales land in the demo DB — re-seed after if
// you want pristine demo data (scripts/dev.sh notes).
// =============================================================================
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE = (__ENV.BASE || 'http://localhost:8082') + '/api'
const HDR  = (token) => ({ headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` } })

export const options = {
  scenarios: {
    cashier_sales: {
      executor: 'constant-vus', exec: 'cashierSale',
      vus: 10, duration: '2m', startTime: '0s',
    },
    // 10 read-hammering accounts ≈ stores pulling catalogue+config; stays
    // inside the 240/min/user API limiter on purpose (the limiter itself was
    // separately verified to reject overage — that's a feature). Real
    // 50-store sync rides per-integration V1 API keys, not these accounts.
    sync_reads: {
      executor: 'constant-vus', exec: 'syncRead',
      vus: 10, duration: '45s', startTime: '2m10s',
    },
  },
  thresholds: {
    'http_req_duration{endpoint:sale}':     ['p(95)<200'],
    'http_req_duration{endpoint:products}': ['p(95)<200'],
    'http_req_duration{endpoint:store}':    ['p(95)<200'],
    http_req_failed: ['rate<0.01'],
  },
}

// One DISTINCT token per till — matches reality (terminals hold long-lived
// Sanctum tokens; they don't re-login per sale) and the per-user rate
// limiter. Minted by the tinker one-liner in docs/13-dev-workflow.md into
// scripts/.k6-tokens.json (gitignored). Logging in inside setup() would trip
// the login throttle (5/min/IP) — that throttle is a feature, not a bug.
const TOKENS = JSON.parse(open('./.k6-tokens.json'))

export function setup() {
  const stores  = http.get(`${BASE}/stores`, HDR(TOKENS[0])).json().data
  const storeId = stores[0].id
  const products = http.get(`${BASE}/products/pos?store_id=${storeId}`, HDR(TOKENS[0])).json().data
    .filter((p) => p.barcode).slice(0, 40)
  return { tokens: TOKENS, storeId, products }
}

const vuToken = (d) => d.tokens[(__VU - 1) % d.tokens.length]

export function cashierSale(d) {
  const token = vuToken(d)
  // catalogue refresh (what the POS does on category switches)
  const prod = http.get(`${BASE}/products/pos?store_id=${d.storeId}`, {
    ...HDR(token), tags: { endpoint: 'products' },
  })
  check(prod, { 'products 200': (r) => r.status === 200 })

  // ring up 1–3 items, pay cash
  const n = 1 + Math.floor(Math.random() * 3)
  const items = []
  for (let i = 0; i < n; i++) {
    const p = d.products[Math.floor(Math.random() * d.products.length)]
    items.push({
      product_id: p.id, product_name: p.name_nl ?? p.name_en,
      unit_price: Number(p.price), quantity: 1 + Math.floor(Math.random() * 2),
      btw_rate: Number(p.btw_rate ?? 10), btw_exempt: !!p.btw_exempt, discount_srd: 0,
    })
  }
  const sale = http.post(`${BASE}/sales`, JSON.stringify({
    store_id: d.storeId, payment_method: 'cash', cash_tendered: 20000, items,
  }), { ...HDR(token), tags: { endpoint: 'sale' } })
  if (sale.status !== 201 && __ITER < 3) console.error(`sale ${sale.status}: ${String(sale.body).slice(0, 180)}`)
  check(sale, { 'sale 201': (r) => r.status === 201 })

  sleep(1 + Math.random() * 2) // cashier think-time
}

export function syncRead(d) {
  const token = vuToken(d)
  const prod = http.get(`${BASE}/products/pos?store_id=${d.storeId}`, {
    ...HDR(token), tags: { endpoint: 'products' },
  })
  const store = http.get(`${BASE}/stores/${d.storeId}`, {
    ...HDR(token), tags: { endpoint: 'store' },
  })
  check(prod,  { 'products 200': (r) => r.status === 200 })
  check(store, { 'store 200':    (r) => r.status === 200 })
  sleep(0.3 + Math.random() * 0.2)
}
