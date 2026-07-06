# 6 — Register & Z-Report

The cashier's open-shift → close-shift cycle, the manual cash in/out that keeps the drawer honest, and how a day rolls up into the store-level Z-Report that syncs to HQ. Almost everything lives in two files: `backend/app/Http/Controllers/Api/RegisterController.php` and the Z-Report block of `backend/app/Http/Controllers/Api/ReportController.php`.

Two layers, easy to conflate:

| Layer | Row | Granularity | Produced by |
|---|---|---|---|
| Session | `register_sessions` | One cashier's shift on one till | `RegisterController` — open/close + the per-session "mini Z-Report" |
| Day | `z_reports` | One row per **store** per **date** | `ReportController::zReport` — the formal end-of-day close |

---

## The session state machine

`register_sessions.status` is a plain `string(20)` (no DB enum). Three values are ever written:

```
open ──close──▶ closed ──request-reopen──▶ reopen_requested
  ▲                                              │
  └────────────── manager approves ──────────────┘
                  (denies → back to closed)
```

Approval does **not** produce a `reopen_approved` status — `approveReopen` flips the row back to `open` and stamps `reopen_approved_by/at` (`RegisterController.php:440-453`). (`Register::openSession()` tolerates a `reopen_approved` value defensively, but nothing writes it.) On approval the close-out fields (`closing_cash_counted`, `expected_cash`, `discrepancy`, `closed_at`, `closing_note`) are nulled so the cashier re-counts at the next close. Denial keeps `closed` and records `reopen_denial_reason`.

### Opening a session — four guards

`POST /api/registers/{register}/open` takes `opening_float` (required, ≥ 0) and walks four gates in order:

1. **Store assignment** — `$user->canAccessStore($register->store_id)`, else `403 STORE_NOT_ASSIGNED`. Cashiers/SMs are bound to one store (ch 3).
2. **One open session per register** — any existing `open`/`reopen_requested` session on the till → `409 REGISTER_ALREADY_OPEN` (with the blocking session in the payload). Enforced in code, not schema.
3. **Z-Report day lock** — a non-manager cannot open a register that was already closed today (`status = closed`, `closed_at` today, `cleared_at IS NULL`) → `409 REGISTER_CLOSED_FOR_DAY`. The books are sealed; a manager either opens it themselves or runs *clear-closed-today* (below).
4. **One session per cashier per store per day** — the same cashier with another `open`/`reopen_requested` session today → `409 CASHIER_ALREADY_HAS_OPEN_SESSION`.

Every state change writes an `audit_logs` row via `logRegisterActivity` — `register.created/updated/deactivated/opened/closed/cash_movement/cleared_for_next_shift/reopen_requested/reopen_approved/reopen_denied`. Note the helper passes `new_values` as a raw array: pre-encoding it would double-encode the JSONB column and desync the audit hash chain (`RegisterController.php:696-713`).

### Clear-closed-today — shift handover

`POST /api/registers/{register}/clear-closed-today` (manager only, reason required) marks today's closed sessions `cleared_at`/`cleared_by`/`clear_note` so guard #3 ignores them and the next shift can open. The closed sessions themselves are never mutated back — close events are immutable, the clear is a separate audited action (`register.cleared_for_next_shift`).

---

## Cash movements — pay-in / pay-out during a shift

Money enters or leaves a drawer outside of sales: a change top-up, a supplier paid from the till, a bank drop. Unrecorded, each of those becomes a phantom discrepancy at close. The fix is `cash_movements` (`2026_06_12_000001`, model `backend/app/Models/CashMovement.php`):

```
POST /api/registers/sessions/{session}/cash-movements
{ direction: 'in'|'out', amount: > 0, reason: 2..255 chars (required) }
```

- Allowed for the session's own cashier or a manager, only while the session is not closed (`409` otherwise).
- `amount` is always positive — `direction` carries the sign (both enforced by Postgres CHECK constraints).
- Rows are append-only facts: `$timestamps = false`, only an explicit `created_at`; there is no update/delete endpoint.
- Every movement is audit-logged as `register.cash_movement` and the response echoes the recomputed running `expected_cash` so the POS UI updates immediately (`RegisterController.php:286-331`).

---

## Expected cash — the close formula

`computeExpectedCash` + `manualCashNet` (`RegisterController.php:624-658`), all bcmath:

```
expected_cash = opening_float
              + Σ cash_received − change     (completed cash/mixed sales, total ≥ 0)
              − Σ |total|                    (completed cash/mixed refund rows, total < 0)
              + Σ pay-in − Σ pay-out         (cash_movements)
```

Details that keep this honest:

- Only `cash` and `mixed` methods touch the drawer. For `mixed`, `cash_received_srd − change_srd` captures exactly the cash portion; the card portion is in `card_amount_srd`.
- Refunds are stored as negative-total sale rows (ch 4); their `cash_received_srd`/`change_srd` are NULL so they can't leak into the cash-in term.
- `bank_transfer` / `mobile_transfer` / `foreign_cash` / `qr_payment` never appear here — they don't settle the drawer (foreign cash is a physically separate currency count).

## Closing a session

`POST /api/registers/sessions/{session}/close` — the session's own cashier, or a manager who `canAccessStore` the session's store (role alone is not enough: an OA of org A must never close — or read — org B's session by guessing a UUID). Payload: `closing_cash_counted` (required) + optional `closing_note`.

The controller snapshots `expected_cash` at close time and stores `discrepancy = counted − expected` (signed: negative = short, positive = over). All three values persist on the session row, so later movements or edits can never rewrite a closed shift.

## The session mini Z-Report

`GET /api/registers/sessions/{session}/report` (`sessionReport`, `RegisterController.php:501-617`) — same visibility rule as close. One aggregate query splits positive/negative totals with `CASE` expressions rather than two queries:

| Block | Contents |
|---|---|
| Counts | `transaction_count`, `refund_count`, `void_count` + `void_total`, `items_sold` |
| Money | `gross_sales`, `discounts_total`, `refunds_total`, `net_sales`, `total_btw` |
| `payment_breakdown` | Net per method — **all seven**: `cash`, `card`, `mixed`, `bank_transfer`, `mobile_transfer`, `foreign_cash`, `qr_payment` |
| `cash_drawer` | `opening_float`, `cash_in`, `cash_out` (sales-driven), `pay_in`, `pay_out` (manual movements, shown as their own lines), `expected` |
| Close-out | `expected_cash`, `closing_cash_counted`, `discrepancy` |

Before close, `expected_cash` is computed live so the cashier watches the running figure; after close, the endpoint returns the persisted close-time snapshot.

---

## X-Report vs Z-Report

| | X-Report | Z-Report |
|---|---|---|
| Endpoint | `GET /api/reports/x-report` | `POST /api/reports/z-report` |
| Permission | `reports.x_report` | `z_report.close` (+ `canAccessStore`) |
| Effect | None — mid-day snapshot, drawer stays open | Seals the store's day; one row per store per date |
| Repeatable | Any number of times | `409 ALREADY_CLOSED` on the second attempt |

Both are built from the same `buildDailySummary` aggregation; the X-Report response carries the reminder *"Dit is een tussentijds overzicht. De kassalade is NIET afgesloten."*

`zReport` validates `store_id` (`StoreBelongsToOrg`) + `actual_cash_srd` + optional `discrepancy_note`, then persists the day (`ReportController.php:144-205`):

- Totals: `total_sales_srd`, `transaction_count`, `total_btw_srd`.
- **Per-method totals — all seven columns.** `cash_total_srd`, `card_total_srd`, `mixed_total_srd`, `bank_transfer_total_srd`, `mobile_transfer_total_srd`, `foreign_cash_total_srd`, `qr_payment_total_srd`. The last five landed in `2026_07_06_090001_add_method_totals_to_z_reports.php` — before it, the persisted breakdown silently dropped those methods and stopped summing to `total_sales_srd` on a QR-heavy (Mopé / Uni5Pay+) day. Existing rows default to `0.00`.
- Cash reconciliation: `expected_cash_srd` (the day's cash total), `actual_cash_srd` (manager's count), `cash_discrepancy_srd`, and `discrepancy_note` — stored only when the discrepancy is non-zero.
- `top_products` + `btw_breakdown` JSON snapshots for the printed report.

Note the two reconciliation levels don't overlap: pay-ins/pay-outs and opening floats are **session**-level facts folded into each session's expected cash; the store-level Z-Report compares the manager's overall count against the day's cash sales. The session mini Z-reports are where a drawer-level discrepancy is traced.

---

## Sync: pending → sent (→ failed)

`z_reports.sync_status` is a real enum: `pending | sent | failed` (`2026_04_12_200011`, default `pending`). Manual "Submit to Headquarters" — sync option C from the proposal:

```
POST /api/reports/z-report/{zReport}/submit        permission: z_report.submit
  ├── already sent → 409 ALREADY_SENT
  ├── update: sync_status = 'sent', synced_at = now()
  └── broadcast ZReportSubmitted (org channel)     → dashboard store card updates live
```

`GET /api/reports/z-report/history` (`z_report.view_history`) returns the store's last **7** closes for the End-of-Day screen's history table. The broadcast event is documented in [9 — Realtime broadcasts](09-realtime-broadcasts.md); the offline retry ladder around `failed` is [7 — Sync & offline](07-sync-and-offline.md).

---

## Where each piece lives

```
Registers & sessions
├── RegisterController              backend/app/Http/Controllers/Api/RegisterController.php
│   ├── open / close                :136 / :227
│   ├── recordCashMovement          :286
│   ├── clearClosedToday            :348
│   ├── requestReopen/approveReopen :399 / :428
│   ├── sessionReport               :501
│   └── computeExpectedCash         :624
├── Register / RegisterSession      backend/app/Models/Register.php, RegisterSession.php
└── CashMovement                    backend/app/Models/CashMovement.php  (2026_06_12_000001)

Z-Report (store day)
├── ReportController::zReport       backend/app/Http/Controllers/Api/ReportController.php:144
├── ReportController::submitZReport :214   → broadcasts ZReportSubmitted
├── ReportController::zReportHistory:238
├── ZReport                         backend/app/Models/ZReport.php
└── Method-total columns            2026_07_06_090001_add_method_totals_to_z_reports.php
```

---

→ Next: [7 — Sync & offline](07-sync-and-offline.md)
