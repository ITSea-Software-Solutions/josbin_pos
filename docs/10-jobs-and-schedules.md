# 10 — Jobs, schedules & notifications

Everything that runs outside a web request: the queued jobs, the cron schedule, and the queued database notifications behind the in-app bell. Queue driver is Redis; the workers are Laravel Horizon.

Topology first, because it explains the deploy gotcha at the bottom: **Horizon runs in its own `horizon` container** (`docker-compose.yml:129`, `command: php artisan horizon`), the cron loop in its own `scheduler` container (`schedule:run` every 60 s, with a boot-time `rates:ensure-today` so a freshly booted stack has a rate before the first sale). Neither shares a PHP process with `app`.

---

## Queued jobs

| Job | Queue | Trigger | Retry |
|---|---|---|---|
| `RecordStockMovements` | `default` | Dispatched on **void / refund / blind-return** (`Api\SaleController:480,688,818`) to restore stock + write ledger rows | `tries 3`, backoff `30s/2m/10m` |
| `DetectSaleAnomaly` | `ai` | After every completed sale, `->delay(5s)` (`Api\SaleController:406`) | `tries 3`, `timeout 60` |
| `DispatchWebhook` | `default` | `dispatchIfActive` on `/v1/sales` ingest (`sale.created`) — see [ch 8](08-integration-api.md) | `tries 4`, backoff `1m/5m/30m/2h` |

Notes:

- **Sale-time stock is *not* queued.** `StockMovementService::recordSale` runs synchronously inside the sale's DB transaction — a queue outage can no longer desync sale and stock. The queued job only covers the void/refund restore paths.
- `DetectSaleAnomaly` runs heuristic rules (large discount > 30%, off-hours, oversized basket, >3 voids/hour by one cashier, >2σ from the 30-day store average) plus an optional GPT-4o narrative, and writes flagged sales to the audit log as `anomaly_detected`.
- ⚠️ **Documented gap:** `DetectSaleAnomaly` is dispatched to the `ai` queue, but `config/horizon.php` defines only `supervisor-1` with `'queue' => ['default']` — nothing consumes `ai`, so anomaly jobs currently accumulate unprocessed. Fix is adding `ai` to the supervisor's queue list (then bounce the `horizon` container — G-026 below).

---

## Queued notifications — `database` + `mail`

`backend/app/Notifications/`. The four BTW-filing notifications drive the review loop from [ch 5](05-btw-pipeline.md):

| Notification | Recipients | Fired by |
|---|---|---|
| `BtwFilingSubmitted` | All active `tax_inspector` users | New **monthly** filing (daily/weekly don't ping — they'd spam the bell of an inspector whose formal cycle is monthly) |
| `BtwFilingResubmitted` | All active `tax_inspector` users | Every `supersede` (a corrected filing answers a dispute — always ping) |
| `BtwFilingDisputed` | Taxpayer side: the org's active OAs + the original submitter | Inspector disputes (carries the reason) |
| `BtwFilingAccepted` | Same taxpayer set | Inspector accepts (single or bulk — bulk sends one per accepted row, after the transaction commits) |

All four are `ShouldQueue` with `via() = ['database', 'mail']`. That combination is a deliberate isolation design, not a convenience:

- **Queued** → the inspector's (or OA's) web request never waits on SMTP, and a mail/queue hiccup can never fail the accept/dispute/file action itself. The controller helpers (`notifyTaxpayer` / `notifyInspectors`) additionally wrap the send in try/catch — notification delivery is best-effort by contract.
- **Two channels, isolated per job** → Laravel queues one job per recipient×channel, so a failing `mail` job cannot suppress the `database` (bell) row for anyone.
- Practical consequence: **the in-app bell is the source of truth.** The droplet currently has no real `MAIL_*` credentials, so the `mail` channel doesn't deliver until SMTP is configured — the `database` channel works regardless. Check SMTP config before debugging "the email didn't arrive".

The `toDatabase` payload carries bilingual `title`/`message` (`nl`/`en`), the filing `reference`, period, amount and a `link` — the bell renders in the user's locale without a server round-trip.

`WelcomeCredentials` (new-user welcome) is also `ShouldQueue` but **mail-only** (`via() = ['mail']`) — login URL + email address, deliberately never the password, and no bell entry.

Rows live in the standard Laravel `notifications` table (`2026_06_15_000001`, uuid PK + notifiable morphs).

---

## The in-app bell

`NotificationController` (`backend/app/Http/Controllers/Api/NotificationController.php`) — three endpoints, any authenticated role, every query built off `$request->user()->notifications()` so a user can never read or mutate another user's rows:

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/notifications` | Latest 30 + `unread_count` |
| `POST` | `/api/notifications/{id}/read` | Marks one read (404 if not yours), fresh `unread_count` |
| `POST` | `/api/notifications/read-all` | Marks all read, `unread_count: 0` |

Frontend: `dashboard/src/components/shared/NotificationBell.tsx` — badge + dropdown + mark-(all-)read + click-through to the `link`, **polling every 60 s** (`refetchInterval: 60000`). Polling, not Reverb: notification latency of a minute is fine, and the bell must work on installs where the WebSocket port is closed. (Realtime events proper are [ch 9](09-realtime-broadcasts.md).)

---

## Scheduled commands

`backend/routes/console.php` — all pinned to `America/Paramaribo` (AST), long-running ones `runInBackground()->withoutOverlapping()`:

| Time (AST) | Command | Does |
|---|---|---|
| 06:00 daily | `rates:lock` | Fetch + lock today's USD→SRD from ExchangeRate-API (the only source — Frankfurter/ECB has no SRD). Failure logged. |
| every 30 min | `rates:ensure-today` | Idempotent safety net — recreate today's rate if 06:00 missed (container restart, API outage), so a sale never 422s with `NO_DAILY_RATE`. |
| 00:05 daily | `license:check --force` | Validate against the licence server; failure = offline-grace path ([ch 11](11-license-and-delivery.md)). |
| 03:00 daily | `sanctum:prune-expired --hours=24` | Token cleanup. |
| Mon 08:00 | `ai:weekly-summary` | Per-store manager summary in their locale; falls back to a plain stats narrative without an OpenAI key. |

---

## Horizon

Dashboard at `/horizon`, gated by the `viewHorizon` gate (`app/Providers/HorizonServiceProvider.php`). Failed jobs land on the Failed tab with payload + exception; webhook delivery failures from [ch 8](08-integration-api.md) show up here with their remaining retries.

### G-026 — bounce the right container on deploy

Horizon runs in its **own `horizon` container**, not in `app`. So:

```bash
docker compose exec app php artisan horizon:terminate   # ✗ "No processes to terminate" — does nothing
docker compose restart horizon                          # ✓ worker restarts with fresh code
# or: docker compose exec -T horizon php artisan horizon:terminate
```

A stale worker keeps executing old code and **never sees newly added queued classes** — a deploy that adds or changes any job/notification above must bounce the `horizon` container, or filings will "succeed" while no notification ever materialises. (Gotcha registry: `CLAUDE_WORKING_GUIDE.md` §4, G-026. Demo and sandbox stacks have their own `horizon` containers — bounce each stack you deployed to.)

---

## Where each piece lives

```
Jobs
├── RecordStockMovements            backend/app/Jobs/RecordStockMovements.php
├── DetectSaleAnomaly               backend/app/Jobs/DetectSaleAnomaly.php
└── DispatchWebhook                 backend/app/Jobs/DispatchWebhook.php

Notifications
├── BtwFiling{Submitted,Resubmitted,Disputed,Accepted}   backend/app/Notifications/
├── WelcomeCredentials              backend/app/Notifications/WelcomeCredentials.php
├── NotificationController          backend/app/Http/Controllers/Api/NotificationController.php
├── notifications table             2026_06_15_000001_create_notifications_table.php
└── NotificationBell (frontend)     dashboard/src/components/shared/NotificationBell.tsx

Schedule & workers
├── routes/console.php              the cron table above
├── config/horizon.php              supervisor-1 → ['default']
├── horizon container               docker-compose.yml:129
└── scheduler container             docker-compose.yml:158
```

---

→ Next: [11 — License & delivery](11-license-and-delivery.md)
