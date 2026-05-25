# Josbin POS — Developer Documentation

**For:** developers maintaining or extending Josbin POS.
**Companion docs:** end-user training material lives in [/user_manual/](../user_manual/) (POS cashier/manager) and [/dashboard_manual/](../dashboard_manual/) (HQ/admin) once those are written.

If you just want to *run* the project, see the top-level [README.md](../README.md). This folder is the *why* and *how* — the architecture, the flows, and the map of where each thing lives in code.

> **Visual overview** → [`architecture.html`](architecture.html) — single-file interactive page with system overview, tech stack, ER diagram, use cases, sale flow, offline sync, BTW pipeline, AI, and security layers. Open in any browser, or visit `/architecture.html` on the docs site.

---

## Reading order

These docs are written so you can read 1 → 13 to build a complete mental model, or jump to a single doc when you have a focused question.

| # | Doc | What it covers |
|---|---|---|
| 0 | [Installation & Setup Guide](00-installation-and-setup.md) | End-to-end runbook: blank server → first live sale. Read this if you're installing for a new client. |
| 1 | [Architecture overview](01-architecture.md) | Three layers, containers, ports, traffic flow |
| 2 | [Data model](02-data-model.md) | Key entities, relationships, multi-tenancy, money + time conventions |
| 3 | [Auth & roles](03-auth-and-roles.md) | Sanctum tokens, 2FA enforcement, the 6 RBAC roles, session timeouts |
| 4 | [Sale lifecycle](04-sale-lifecycle.md) | A POST /sales request walked end-to-end |
| 5 | [BTW pipeline](05-btw-pipeline.md) | Belastingdienst-compliant tax calculation in bcmath |
| 6 | [Register & Z-Report](06-register-and-z-report.md) | Open → sell → X-Report → Close → Z-Report → Submit to HQ |
| 7 | [Sync & offline resilience](07-sync-and-offline.md) | Five-layer fallback including USB AES-256 export |
| 8 | [Open Integration API](08-integration-api.md) | Layer 3 — third-party sale ingest, webhooks, sandbox |
| 9 | [Realtime broadcasts](09-realtime-broadcasts.md) | Reverb channels and events |
| 10 | [Jobs & schedules](10-jobs-and-schedules.md) | Queues, cron jobs, AI background work |
| 11 | [License & delivery](11-license-and-delivery.md) | License server, IonCube encoding, code signing |
| 12 | [Code map](12-code-map.md) | Feature → file index |
| 13 | [Development workflow](13-dev-workflow.md) | Common commands, debugging, adding a new feature |

---

## Conventions across all docs

- **Money** is always SRD, always `DECIMAL(12,2)`, always `bcmath` strings in PHP. Never floats. See [05-btw-pipeline.md](05-btw-pipeline.md).
- **Time** is always AST (`America/Paramaribo`, UTC-3). PostgreSQL `timestamptz`. Frontend renders via the user's date-format preference.
- **IDs** are UUIDs (v4 — random, not time-sortable; sort by `created_at` when you need ordering). Sanctum personal access tokens and `audit_logs.id` are the exceptions (bigint).
- **File paths** in code are written `backend/app/Http/Controllers/Api/SaleController.php:128` so you can click to the exact line in your editor.
- **External docs** that may rot are linked but the load-bearing facts are repeated inline.

---

## When something doesn't match the docs

The code is the source of truth. If you find a mismatch:

1. Confirm against the latest commit (`git log -- backend/app/...`).
2. If the doc is wrong, update it in the same PR as the code change. Stale docs are worse than no docs.
3. If you're unsure which is right, [BUILD_STATUS.md](../BUILD_STATUS.md) tracks the current per-feature state and may explain it.
