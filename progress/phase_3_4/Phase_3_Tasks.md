# Josbin POS — Phase 3 Task List
**Super Admin Dashboard + Open Integration API**
Timeline: Weeks 8–13 (572 hours total)

---

## Status Legend
- ✅ Complete
- 🔄 In Progress
- ⬜ Not Started

---

## Dashboard — Core Infrastructure
| Task | Status | Notes |
|---|---|---|
| React 19.2 dashboard scaffold (Vite, TypeScript, TanStack Query, Zustand) | ✅ | |
| Sanctum authentication flow (login, logout, me) | ✅ | |
| 2FA challenge screen (TOTP 6-digit input) | ✅ | |
| 2FA setup screen (QR + confirm + recovery codes) | ✅ | |
| Dashboard layout with sidebar navigation | ✅ | |
| Bilingual UI (Dutch/English instant toggle) | ✅ | |
| Laravel Echo WebSocket client (Reverb) connected | ✅ | |
| Live store cards with WebSocket updates | ✅ | |
| Session timeout enforcement (60 min dashboard) | ✅ | |

---

## Organisation & Store Management
| Task | Status | Notes |
|---|---|---|
| Organisations screen — list all with search | ✅ | |
| Create organisation modal | ✅ | |
| Edit / deactivate organisation | ⬜ | Edit modal needed |
| Stores screen — list per organisation | ✅ | |
| Create store under organisation | ✅ | |
| Edit store (receipt header, footer, default BTW rate) | ⬜ | Frontend form needed |
| Deactivate store | ⬜ | Backend done, UI needed |
| Push catalogue to all stores in org (WebSocket broadcast) | ✅ | Button in Organisations screen |

---

## Product Catalogue Management (Dashboard)
| Task | Status | Notes |
|---|---|---|
| Product list view with search/filter by category | ⬜ | Dashboard product CRUD screen |
| Create product from dashboard | ⬜ | API ready, UI needed |
| Edit product from dashboard | ⬜ | API ready, UI needed |
| Deactivate / delete product | ⬜ | API ready, UI needed |
| CSV bulk import from dashboard | ⬜ | API ready, UI needed |
| Per-store price override management | ⬜ | Table exists, UI + endpoint needed |
| Product image upload (endpoint + frontend) | ⬜ | `image_path` column exists, upload not built |
| AI auto-category suggestion on new product | ⬜ | Phase 2 post-launch feature |

---

## User Management
| Task | Status | Notes |
|---|---|---|
| Users screen — list all users with role filter | ✅ | |
| Create user with role assignment | ✅ | |
| Edit user (name, email, role, locale) | ⬜ | Edit modal needed |
| Activate / deactivate user | ✅ | |
| Reset user 2FA | ✅ | |
| Enforce 2FA requirement per role (government mandatory) | ✅ | Backend policy enforced |
| Single-device enforcement (government accounts) | ✅ | Revoke all previous tokens on login (AuthController) |
| Geo-alert (login from outside Suriname) | ✅ | ip-api.com lookup, email alert, never blocks login |

---

## Security Hardening
| Task | Status | Notes |
|---|---|---|
| Audit log hash chain (SHA-256 row chaining) | ✅ | `AuditHashService`, `AuditLog` model, `audit:verify` command |
| Webhook HMAC-SHA256 signing header | ✅ | `X-Josbin POS-Signature: sha256=HMAC`, dedicated `webhook_secret` column |
| Nginx rate limiting at proxy level | ✅ | `limit_req_zone` in `docker/nginx/default.conf` |
| CSP headers verified and tightened | ✅ | `Permissions-Policy`, `frame-ancestors none` in Nginx |
| Input sanitization middleware (null bytes, control chars) | ⬜ | Global middleware |

---

## Reports (Consolidated, Multi-store)
| Task | Status | Notes |
|---|---|---|
| Consolidated daily report (all stores) | ✅ | |
| Consolidated monthly report | ✅ | |
| Custom date range consolidated | ✅ | |
| BTW consolidated — Belastingdienst Suriname format | ✅ | |
| Top products across entire network | ✅ | |
| PDF export (Dutch/English, organisation letterhead) | ✅ | |
| CSV export | ✅ | |
| Store performance comparison side by side | ⬜ | Compare stores UI not built |
| Rekenkamer audit export (signed PDF, SHA-256) | ✅ | |

---

## Z-Report / End of Day (Dashboard Side)
| Task | Status | Notes |
|---|---|---|
| Z-Reports screen with 7-day history | ✅ | |
| Sync status per day per store | ✅ | |
| USB import panel (.josbin_pos encrypted file) | ✅ | |
| Mark day as "synced late" in audit trail | ✅ | |

---

## Audit Log
| Task | Status | Notes |
|---|---|---|
| Audit log viewer (filterable by event, user, date) | ✅ | |
| Append-only enforcement (DB write protection) | ✅ | |
| Rekenkamer export button in audit log screen | ✅ | |
| Hash chain integrity verification command | ✅ | `php artisan audit:verify --org=uuid` or `--all` |

---

## AI Features v1
| Task | Status | Notes |
|---|---|---|
| Smart product search (trigram similarity, Dutch/English) | ✅ | Falls back to ILIKE |
| pgvector semantic embeddings | ⬜ | Deferred — trigram ships at launch |
| Fraud & anomaly detection (5 heuristic rules) | ✅ | Queued job, 5s delay |
| GPT-4o Dutch/English anomaly narrative | ✅ | Optional, graceful fallback |
| Weekly AI sales summary (Monday 08:00 AST) | ✅ | GPT-4o or plain stats |
| AI widgets in dashboard overview | ✅ | Summary card + anomaly alerts |
| Auto product categorisation suggestion | ⬜ | Phase 2 post-launch |

---

## Open Integration API — Layer 3
| Task | Status | Notes |
|---|---|---|
| `POST /v1/sales` — single sale (idempotent) | ✅ | |
| `POST /v1/sales/batch` — up to 500 sales | ✅ | |
| `GET /v1/reports/sales` — paginated list | ✅ | |
| `GET /v1/reports/summary` — totals + BTW breakdown | ✅ | |
| X-API-Key middleware authentication | ✅ | |
| Rate limiting (1,000/min per key) | ✅ | |
| Outbound webhooks (queue-backed, retry) | ✅ | |
| Webhook HMAC-SHA256 `X-Josbin POS-Signature` header | ✅ | Dedicated `webhook_secret`, rotate endpoint added |
| OpenAPI 3.1 specification | ✅ | `backend/public/api-docs/openapi.yaml` |
| Swagger UI page (renders spec visually) | ⬜ | Static HTML serving RapiDoc or Swagger UI |
| Sandbox environment (test keys, no real data) | ⬜ | Flag or separate tenant |

---

## License Management
| Task | Status | Notes |
|---|---|---|
| License table + migration | ✅ | |
| `GET /api/licenses` | ✅ | |
| `POST /api/licenses/{id}/renew` | ✅ | |
| License management screen (dashboard) | ✅ | |
| `LicenseCheck` scheduled command | ✅ | |
| `LicenseWarning` WebSocket broadcast | ✅ | |
| License banner in POS | ✅ | |
| Soft lock middleware (block new sales) | ⬜ | Check license on `POST /api/sales` |
| Hard lock middleware (block login) | ⬜ | Check license on `POST /api/auth/login` |
| Hardware fingerprint binding (Electron) | ⬜ | MAC + CPU ID + UUID in main process |
| License server app (separate Laravel project) | ⬜ | Separate codebase deliverable |

---

## Product Enhancements
| Task | Status | Notes |
|---|---|---|
| Stock movement log (table + tracking on sale/void) | ✅ | `StockMovement` model, `StockMovementService`, `RecordStockMovements` job |
| Customer CSV import | ✅ | `POST /api/customers/import` — phone dedup via HMAC hash |
| Discount rules engine (time-based promotions) | ✅ | `discount_rules` table, `DiscountRuleService`, auto-applied before BTW |
| Multi-currency receipt line (SRD + USD equivalent) | ✅ | USD line on receipt using `exchange_rate_used`, bilingual label |
| Product image upload | ✅ | `POST /api/products/{product}/image` → `storage/public/products/` |

---

## Infrastructure & DevOps
| Task | Status | Notes |
|---|---|---|
| `GET /api/health` endpoint (DB + Redis + queue check) | ✅ | Unauthenticated, returns 200/503 |
| Docker health checks on all containers | ✅ | All containers in `docker-compose.yml` |
| Supervisor config for queue workers | ✅ | `docker/supervisor/supervisord.conf` |
| PgBouncer connection pooling | ✅ | Transaction mode, 500 max clients |
| Nginx rate limiting (`limit_req_zone`) | ✅ | `docker/nginx/default.conf` |
| Automated encrypted DB backup (cron + AES-256) | ✅ | `docker/scripts/backup.sh` + Sunday restore test |
| Zero-downtime deployment script (`deploy.sh`) | ✅ | PHP-FPM reload + Horizon terminate |
| Log rotation config | ⬜ | Laravel logs + Nginx logs |

---

## Phase 3 Progress Overview

| Category | Complete | Remaining |
|---|---|---|
| Dashboard infrastructure | 9/9 | 0 |
| Org & store management | 5/8 | 3 |
| Product catalogue UI | 0/8 | 8 |
| User management + security | 6/8 | 2 |
| Security hardening | 4/5 | 1 |
| Reports | 8/9 | 1 |
| Z-report / End of Day | 4/4 | 0 |
| Audit log | 4/4 | 0 |
| AI features | 5/7 | 2 |
| Open Integration API | 8/11 | 3 |
| License management | 7/11 | 4 |
| Product enhancements | 5/5 | 0 |
| Infrastructure & DevOps | 7/8 | 1 |
| **TOTAL** | **72/97** | **25** |
