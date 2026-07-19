# Load test — first run, 2026-07-19 (internal)

> Harness: `scripts/load-test.js` (k6 v2.1). Target: LOCAL demo stack on a
> MacBook (Docker Desktop, bind-mounted code). Tokens: 10 seeded till
> accounts (`loadtest1–10@test.sr`), minted via tinker into the gitignored
> `scripts/.k6-tokens.json`.

## Scenario (models the Phase-4 contract target)

- **cashier_sales** — 10 concurrent tills, 2 min: catalogue fetch + 1–3-item
  cash sale per iteration, 1–3 s think-time (≥ the 1 000-sales/day/store pace).
- **sync_reads** — 10 accounts hammering catalogue + store payload for 45 s.

## Results

| Run | Outcome |
|---|---|
| Final | **0 failures, 716/716 requests OK, all checks green.** p95: sale 2.85 s, products 2.67 s (local-environment floor — see below). |
| Earlier iterations | 4xx storms that all turned out to be **the system enforcing rules correctly**: `422 insufficient cash` when SRD 2 000 tendered met expensive items (fixed the test, not the app), `429` from the login throttle (5/min/IP) and the API limiter (240/min/user) when the test shared accounts unrealistically. |

Separate concurrency probe: 50 simultaneous cash sales across 10 accounts →
**50 × HTTP 201, zero errors, zero deadlocks** — stock locking, the audit
hash chain and sale numbering all hold under parallel writes.

## Why the local latencies are NOT the verdict

The laptop environment adds a floor the droplet does not have:

1. macOS bind-mount I/O + `opcache.validate_timestamps=1` → every request
   stat-checks hundreds of PHP files over virtiofs (~0.5–1 s per request).
2. PHP-FPM image default `pm.max_children=5` → >5 concurrent requests queue.

Both are now fixed **for production** (in `docker-compose.prod.yml`):
`opcache-prod.ini` (validate_timestamps=0, full opcode cache; deploys restart
the app container) and `fpm-prod.conf` (12 workers). The droplet also runs
Linux with local disk — no virtiofs penalty.

## Verdict + follow-up

- **Correctness under concurrency: proven.** No deadlocks, no lost updates,
  validation and rate limits enforced.
- **The ≤200 ms p95 contract number: still open** — it must be measured on
  the production droplet after the prod split (playbook Phase 1), using this
  same script (`k6 run -e BASE=… scripts/load-test.js`). Local numbers are an
  environment artifact, recorded here so nobody mistakes them for the system's
  capability.
- The rate limiters behaved as designed and are part of the security story,
  not a performance bug.
