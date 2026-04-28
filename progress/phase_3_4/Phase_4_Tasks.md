# Josbin POS — Phase 4 Task List
**Integration, UAT & Go-Live**
Timeline: Weeks 14–18 (324 hours total)

---

## Status Legend
- ✅ Complete
- 🔄 In Progress
- ⬜ Not Started

---

## Testing — Backend Unit Tests
| Task | Status | Notes |
|---|---|---|
| BTW Calculation Service — 50+ scenarios | ✅ | All passing |
| SRD rounding functions | ✅ | |
| Discount engine (% and fixed SRD, correct order) | ✅ | |
| Exchange rate lock logic | ✅ | |
| Sale number auto-generation | ✅ | |
| License urgency calculation | ⬜ | Unit test each urgency tier |
| Anomaly detection — each of 5 heuristic rules | ⬜ | Isolated unit tests per rule |
| Audit log hash chain integrity | ⬜ | Test chain is unbroken after inserts |
| Discount rules engine evaluation | ⬜ | `DiscountRuleService` — rule priority, time windows, buy-x-get-y |
| Stock movement balance reconciliation | ⬜ | Test running total matches current stock_qty |

---

## Testing — Backend Integration Tests
| Task | Status | Notes |
|---|---|---|
| Authentication endpoints (login, 2FA, refresh, logout) | ✅ | |
| Sale creation — full flow (items, BTW, exchange rate) | ✅ | |
| Void and refund — policy enforcement | ✅ | |
| CSV import (products) | ⬜ | |
| CSV import (customers) | ✅ | `POST /api/customers/import`, WBP-S compliant phone dedup |
| Product image upload — file stored, URL returned | ✅ | `POST /api/products/{id}/image`, 2 MB max, public storage |
| Rekenkamer PDF generation | ⬜ | |
| USB export/import round-trip (encrypt → decrypt → verify) | ⬜ | |
| Webhook dispatch and retry | ⬜ | |
| Webhook HMAC signature verification | ✅ | `sha256=HMAC(body, webhook_secret)` on all outbound |
| V1 API idempotency (duplicate sale_ref) | ⬜ | |
| Single-device enforcement (second login revokes first token) | ⬜ | |
| Geo-alert fires on non-Suriname government login | ⬜ | |
| Soft lock — `POST /api/sales` blocked after license expiry | ⬜ | |
| Hard lock — login blocked after grace + 30 days | ⬜ | |
| Discount rule applied correctly on eligible sale | ⬜ | |
| All 47 API endpoints — auth enforcement + response shape | 🔄 | Ongoing |

---

## Testing — Performance
| Task | Status | Notes |
|---|---|---|
| k6 load test script — 10 concurrent POS terminals | ✅ | `tests/load/pos_concurrent.js` + seeder script |
| k6 — 1,000 transactions/day/store (single store) | ⬜ | |
| k6 — 50 stores syncing simultaneously | ⬜ | |
| WebSocket: 50 concurrent clients receiving broadcasts | ⬜ | |
| Product search <100ms under load | ⬜ | |
| Z-report generation <3s with 1,000-sale day | ⬜ | |
| Rekenkamer PDF <5s for 10,000 transactions | ⬜ | |
| PgBouncer under connection spike (100 simultaneous connects) | ⬜ | |

---

## Testing — Frontend (POS / Electron)
| Task | Status | Notes |
|---|---|---|
| Playwright E2E — login → select store → sell → receipt | ✅ | `tests/e2e/specs/01-04` — golden path, BTW, USD, hold bill |
| Playwright E2E — hold bill → restore → complete | ✅ | Covered in `02_pos_sale.spec.ts` |
| Playwright E2E — end of day Z-report + submit to HQ | ✅ | `tests/e2e/specs/03_z_report.spec.ts` |
| Playwright E2E — dashboard overview + catalogue push | ✅ | `tests/e2e/specs/05_dashboard_overview.spec.ts` |
| Playwright E2E — void sale → audit log entry created | ⬜ | Not yet written |
| Playwright E2E — 2FA setup + challenge flow | ⬜ | Not yet written |
| Manual — barcode scanner USB HID hardware test | ⬜ | Requires physical scanner |
| Manual — Quagga2 camera scan (EAN-13, Code 128) | ⬜ | Requires camera hardware |
| Manual — receipt print to EPSON TM-T20 | ⬜ | Requires hardware |
| Manual — label print on label printer | ⬜ | Requires hardware |
| Manual — offline mode (disconnect → sell → reconnect → sync) | ⬜ | Network simulation |
| Manual — cash change calculation edge cases | ⬜ | |
| Manual — on-screen keyboard all keys + Dutch accents | ⬜ | |
| Manual — language toggle across all screens | ⬜ | |
| Manual — license banner appears at correct urgency | ⬜ | |
| Manual — multi-currency receipt line shows correct USD | ✅ | Auto-covered by Playwright receipt spec |

---

## Testing — Frontend (Dashboard)
| Task | Status | Notes |
|---|---|---|
| Playwright E2E — consolidated report downloads as PDF | ⬜ | |
| Playwright E2E — push catalogue → POS refetches in <3s | ⬜ | |
| Playwright E2E — USB import (.josbin_pos) → sales in reports | ⬜ | |
| Manual — live store cards update on sale (WebSocket) | ⬜ | |
| Manual — Rekenkamer PDF SHA-256 hash matches footer | ⬜ | |
| Manual — license renewal request → audit trail entry | ⬜ | |
| Manual — BTW consolidated figures match store totals | ⬜ | |

---

## Security Testing (OWASP Top 10)
| Test | Status | Notes |
|---|---|---|
| A01 — cross-org data access attempt blocked | ⬜ | Try accessing another org's products/sales |
| A01 — cashier cannot reach manager/admin endpoints | ⬜ | Role policy on every route |
| A01 — auditor is read-only (no mutations succeed) | ⬜ | |
| A02 — TLS 1.3 enforced, older disabled | ⬜ | SSL Labs A+ target |
| A02 — field-level encryption verified (PII unreadable in DB) | ⬜ | Direct Postgres inspection |
| A02 — `.josbin_pos` file unreadable without correct key | ⬜ | Try decrypting with wrong store_id |
| A03 — SQL injection on all string inputs | ⬜ | Eloquent parameterisation audit |
| A03 — XSS via product names, receipt content, notes | ⬜ | React escaping + CSP headers |
| A04 — brute force: 5 attempts → 15 min lockout | ⬜ | |
| A04 — progressive login delays (1s, 2s, 4s, 8s...) | ⬜ | |
| A05 — debug mode off in production | ⬜ | `APP_DEBUG=false` verified |
| A05 — no sensitive data in error responses | ⬜ | Stack traces not exposed |
| A07 — session timeout enforced (15 min POS, 60 min dash) | ⬜ | |
| A07 — forced logout on role change across all devices | ⬜ | |
| A07 — single-device enforcement for govt accounts | ⬜ | |
| A09 — all admin actions in audit log (no gaps) | ⬜ | Check 20 admin actions |
| A09 — audit log tamper attempt rejected | ⬜ | Try UPDATE/DELETE on audit_logs |
| A09 — audit log hash chain intact after 1,000 entries | ⬜ | |
| Rate limiting — API throttle (1,000/min per key) | ⬜ | |
| Rate limiting — Nginx proxy level (before Laravel) | ⬜ | |
| Geo-alert — govt login from non-SR IP triggers email | ⬜ | |
| Webhook HMAC — tampered payload rejected by receiver | ⬜ | |
| **Written OWASP Top 10 compliance report** | ⬜ | Signed document, client deliverable |

---

## Code Protection & Packaging

### IonCube Encoding
| Task | Status | Notes |
|---|---|---|
| IonCube Loader added to Docker container | ⬜ | |
| Encoding script for all Laravel PHP files | ⬜ | |
| CI/CD step: encode before Docker build | ⬜ | |
| Test: encoded app runs correctly | ⬜ | |
| Test: source is unreadable | ⬜ | |

### Electron Packaging (Windows)
| Task | Status | Notes |
|---|---|---|
| `electron-builder` NSIS installer configuration | ⬜ | .exe for Windows |
| DevTools disabled in production build | ⬜ | |
| Code signing certificate applied | ⬜ | Prevents SmartScreen warning |
| Hardware fingerprint collection (MAC + CPU + UUID) | ⬜ | Main process code |
| Auto-updater configured | ⬜ | |
| Clean install test on Windows 10 | ⬜ | |
| Clean install test on Windows 11 | ⬜ | |
| Uninstall — no data remnants | ⬜ | |

### License System
| Task | Status | Notes |
|---|---|---|
| Hardware fingerprint → license server verification | ⬜ | |
| License key check on Electron startup | ⬜ | |
| 24-hour background license check | ⬜ | |
| 72-hour offline grace mode | ⬜ | |
| Soft lock middleware (`POST /api/sales` blocked) | ⬜ | |
| Hard lock middleware (login blocked) | ⬜ | |
| License server app (separate Laravel project) | ⬜ | |
| License server: issue / renew / revoke key endpoints | ⬜ | |
| Full expiry flow test (warning → grace → soft → hard) | ⬜ | |

---

## Infrastructure & DevOps (Production)
| Task | Status | Notes |
|---|---|---|
| `GET /api/health` endpoint | ✅ | DB + Redis + queue worker check |
| Docker health checks on all containers | ✅ | `HEALTHCHECK` in Compose |
| Supervisor config for queue workers | ✅ | `supervisord.conf` |
| PgBouncer connection pooling | ✅ | Sidecar in Docker Compose |
| Nginx rate limiting (`limit_req_zone`) | ✅ | Proxy-level before Laravel |
| Automated encrypted DB backup (cron + AES-256) | ✅ | Daily pg_dump → offsite |
| Zero-downtime deployment script | ✅ | `deploy.sh` |
| Log rotation config | ⬜ | Laravel + Nginx log rotation |
| Production server provisioned (Docker, SSL, domain) | ⬜ | |
| Let's Encrypt SSL certificate | ⬜ | Auto-renew via certbot |
| Laravel Nightwatch production monitoring | ⬜ | |
| Error alerting (email + Slack on 500s) | ⬜ | |

---

## Staging Environment
| Task | Status | Notes |
|---|---|---|
| Staging server provisioned | ⬜ | Same Docker stack as production |
| Seed 200+ realistic Surinamese products | ⬜ | Dutch/English names |
| Seed 5 test organisations (retail, govt, wholesale) | ⬜ | |
| Seed 3 months of historical sales data | ⬜ | Realistic report testing |
| Seed all role accounts | ⬜ | One of each role |
| Staging Electron app pointing to staging API | ⬜ | |
| Hardware test on staging: scanner, printer, label printer | ⬜ | Requires hardware |

---

## Compliance Documentation (Suriname)
| Deliverable | Status | Notes |
|---|---|---|
| OWASP Top 10 compliance report (written, signed) | ⬜ | Client deliverable |
| WBP-S privacy impact assessment | ⬜ | Surinamese data protection law |
| Verwerkersovereenkomst (Data Processing Agreement) Dutch | ⬜ | Required for govt clients |
| Belastingdienst Suriname BTW format verification | ⬜ | Confirm with tax authority |
| Rekenkamer audit export format verification | ⬜ | Confirm with Court of Audit |
| Dutch-language incident response plan | ⬜ | Govt clients — physical binder + digital |
| Network setup guide in Dutch | ⬜ | For local Docker installs |

---

## Client UAT
| Task | Status | Notes |
|---|---|---|
| UAT checklist document (Dutch) | ⬜ | Formal sign-off document |
| UAT session 1 — cashier POS flows | ⬜ | |
| UAT session 2 — manager Z-report + End of Day | ⬜ | |
| UAT session 3 — dashboard admin flows | ⬜ | |
| UAT session 4 — reports + BTW export verification | ⬜ | |
| Defect log — all critical defects resolved | ⬜ | |
| Client formal sign-off (signature) | ⬜ | Nothing ships without this |

---

## First Store Go-Live
| Task | Status | Notes |
|---|---|---|
| Production server provisioned | ⬜ | |
| .exe installer built and code-signed | ⬜ | |
| Install on client's POS terminals (on-site) | ⬜ | |
| Install on client's back-office PC (local Docker) | ⬜ | |
| Thermal printer configured, receipt test printed | ⬜ | |
| First live sale processed | ⬜ | Milestone |
| First Z-Report submitted | ⬜ | Milestone |

---

## Staff Training
| Task | Status | Notes |
|---|---|---|
| Training materials prepared (Dutch, with screenshots) | ⬜ | Cashier guide + manager guide |
| Cashier training — POS basics (1 hour) | ⬜ | Per terminal |
| Manager training — Z-report, reports, exchange rate (2 hours) | ⬜ | |
| Admin training — dashboard, users, licences (2 hours) | ⬜ | |
| Quick reference card printed (A4, laminated) | ⬜ | Per terminal |

---

## Post-Launch Monitoring (30 Days)
| Task | Status | Notes |
|---|---|---|
| Laravel Nightwatch active | ⬜ | |
| Error alerting configured | ⬜ | |
| Daily backup verification | ⬜ | |
| Week 1 client check-in | ⬜ | |
| Week 2 client check-in | ⬜ | |
| Week 4 — 30-day post-launch review | ⬜ | Written summary report |
| Independent penetration test arranged | ⬜ | Recommended post-launch |

---

## Phase 4 Progress Overview

| Category | Complete | Remaining |
|---|---|---|
| Backend unit tests | 5/10 | 5 |
| Backend integration tests | 3/17 | 14 |
| Performance tests | 0/8 | 8 |
| Frontend (POS) tests | 0/15 | 15 |
| Frontend (Dashboard) tests | 0/7 | 7 |
| OWASP security testing | 0/22 | 22 |
| Code protection & packaging | 0/18 | 18 |
| Infrastructure & DevOps | 7/12 | 5 |
| Staging environment | 0/7 | 7 |
| Compliance docs | 0/7 | 7 |
| Client UAT | 0/6 | 6 |
| Go-live | 0/7 | 7 |
| Staff training | 0/5 | 5 |
| Post-launch monitoring | 0/6 | 6 |
| **TOTAL** | **15/131** | **116** |
