# Chapter 11 — Z-Reports & End-of-Day Sync

**Who needs this:** Store Manager (closes the day), Organisation Admin (watches sync status, re-submits if anything's stuck, imports USB backups from offline branches), Super Admin (vendor support when a store can't sync at all). Auditor reads it but never closes anything.

**When you use it:**
- **Once a day, per store**, at end of trading — the manager closes the day from the POS-side End of Day screen, then watches it land in this dashboard.
- **Every morning**, the Org Admin checks the **Z-Reports & Sync** screen — any row stuck on `pending` or `failed` more than a few hours is a day's data that hasn't reached HQ yet.
- **Ad-hoc, after a power cut or a network outage** — to import a `.josbin_pos` USB backup from a store that couldn't sync at all.

**What this prevents:**
- **Lost revenue numbers.** If a Z-Report doesn't sync to HQ for any reason, the data is still on the store's local Postgres — but HQ doesn't *see* it on the consolidated dashboard. Catching `pending` rows early is how you keep the HQ view honest.
- **BTW-filing surprises.** The monthly BTW report (Ch 10) is only complete if every day in the month has synced. One missing day in May means a thousand-SRD discrepancy on the June filing.
- **"It's lost" panic.** It almost never is. The five-layer fallback (§11.7) ensures every closed day reaches HQ eventually — usually within seconds, occasionally only when someone walks the file there on a USB stick.

> _Screenshot placeholder: `dashboard_manual/screenshots/11-z-reports-overview.png`._

---

## 11.1 The most important distinction in this chapter

**Cashier register close** and **store-level Z-Report** are different things. People confuse them constantly. They run at different times, by different people, on different screens.

| | **Cashier register close** | **Store-level Z-Report** |
|---|---|---|
| Who | Cashier (per shift) | Store Manager (per day) |
| When | End of every shift — typically multiple times a day at a busy store | Once per day, after the **last** cashier has closed |
| Where | POS app → top bar → **Kassa sluiten / Close register** | POS app → top bar → **Dagafsluiting / End of Day** |
| Documented in | [POS user manual ch 3 — Your register](../user_manual/03-register.md) | [POS user manual ch 10 — End of day](../user_manual/10-end-of-day.md), this chapter (HQ side) |
| What it locks | One **register session** — one drawer for one shift | The **entire trading day** for the store |
| What it persists | A `register_sessions` row with the cash count for that shift | A `z_reports` row with the day's totals + sync status |
| Cash reconciliation | Per-drawer | Whole store, including all drawers |
| Permission | `register_session.close` (cashier holds this for own drawer) | `z_report.close` (manager+ only) |
| Sync to HQ | No — purely local | **Yes** — submit-to-HQ flow |
| Idempotent? | A register can be closed and reopened multiple times | **One per store per day**, hard-enforced by DB unique constraint; second close-same-day returns `409 ALREADY_CLOSED` |

If a cashier closes their register at 14:00 because they're going home, that's a register close. If a different cashier opens the same register at 14:05 to take the evening shift, that's a new register session — no Z-Report yet. The Z-Report happens **once**, at the very end, when all the cashiers are done.

The dashboard's **Z-Rapporten & Synchronisatie / Z-Reports & Sync** screen shows only the second kind (`z_reports` rows). For register-session history at the cashier level, see the **Registers** screen ([Chapter 8 — Registers](08-registers.md)) — that's where you investigate "which cashier was on Kassa 2 between 09:00 and 14:00".

---

## 11.2 The Z-Reports & Sync screen tour

**Path:** Dashboard → left sidebar → **Z-Rapporten / Z-Reports**.

> _Screenshot placeholder: `dashboard_manual/screenshots/11-z-reports-screen.png`._

Three things on this screen:

1. **Stats row** (top) — four KPI cards: total Z-Reports in scope, synced, pending, failed.
2. **USB import panel** (collapsible) — Layer 4 emergency upload. Closed by default; click to expand.
3. **Filterable table** — every closed day, newest first, with sync status.

The screen auto-refreshes every 60 seconds. You can also force a refresh with the **Vernieuwen / Refresh** button.

### Filter bar

| Filter | Default | Notes |
|---|---|---|
| **Van / From** | 7 days ago | Filters by `report_date` (the calendar date the day was closed). |
| **Tot / To** | Today | Inclusive. |
| **Sync status** | All | Pick `Pending`, `Synced`, or `Failed` to narrow. |

### Table columns

| Column | What it shows |
|---|---|
| **Datum / Date** | `report_date` — the AST calendar date the Z-Report belongs to. |
| **Vestiging / Store** | Store name + city. |
| **Omzet / Revenue** | `total_sales_srd` — the day's gross revenue (BTW-inclusive). |
| **BTW** | `total_btw_srd` — collected tax for the day. |
| **Trans.** | `transaction_count` — completed sales. Voids excluded. |
| **Kasgeschil / Cash diff.** | `cash_discrepancy_srd`. Green "OK" pill if exact. Red pill if the counter was short (e.g. `−SRD 5.00`). Amber pill if over (e.g. `+SRD 2.00`). Any non-zero value, including positive, means the cashier's count didn't match what the system expected. |
| **Sync** | One of four pills — see §11.3. |
| **Afgesloten door / Closed by** | Name of the manager who clicked **Close day**. AST timestamp of the most recent sync attempt underneath. |

Hover a row to highlight it (UI-only — there's no row-level action menu in this release). To re-submit a stuck Z-Report, you currently use the POS-side End of Day screen on the store's back-office computer; HQ-side resubmit is a planned action button (see §11.10 — Roadmap).

### Stats KPI cards

| Card | Value |
|---|---|
| **Totaal / Total** | Total rows matching the date filter (regardless of status). |
| **Verzonden / Synced** | Rows where `sync_status = synced`. |
| **In wachtrij / Pending** | Rows where `sync_status = pending`. |
| **Mislukt / Failed** | Rows where `sync_status = failed`. |

In a healthy operation, **Pending = number of stores that are still trading** (today's row sits at `pending` until the manager actually closes), and **Failed = 0**. Anything else is worth investigating.

### Backend endpoint

```
GET /api/dashboard/z-reports?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&sync_status=pending&per_page=50
```

Source: `backend/app/Http/Controllers/Api/DashboardController.php::zReports`.

---

## 11.3 Sync status — the four states

A Z-Report row is always in exactly one of these states. (`z_reports.sync_status` is a string column; the enum values come from the back-office code.)

| State | Pill colour | Meaning | What you do |
|---|---|---|---|
| **`pending`** | Amber | Closed locally, not yet pushed to HQ. Today's Z-Report sits here from the moment the manager clicks Close Day until the submit-to-HQ call succeeds. | Wait. If it stays here longer than expected, check Layer 1–2 status (§11.7) and use Layer 4 (USB) if the network is genuinely unavailable. |
| **`sent`** / **`synced`** | Green | Pushed to HQ successfully. The figure is now reflected in the consolidated dashboard. | Nothing — this is the goal state. (The backend uses `sent` internally; some payloads from the consolidated dashboard normalise this to `synced` for display.) |
| **`failed`** | Red | Push to HQ tried and failed. Specific reasons (4xx, 5xx, timeout) are not currently surfaced in the dashboard — you'd find them in the back-office Laravel log. | Investigate. Often it's a transient network blip and the next retry succeeds. Persistent fail = USB export (§11.5). |
| **`never`** | Grey | No sync has ever been attempted. Rare — only happens if a Z-Report exists but the submit-to-HQ call was never made (e.g. legacy data from before the sync flow existed). | Manually submit from the POS-side End of Day screen. |

> **Honest caveat — what "synced" actually means today.** In the current release, `submitZReport` flips the `sync_status` from `pending` to `sent` and stamps `synced_at` on the **local** row, then broadcasts `ZReportSubmitted` so the consolidated dashboard updates live. The actual HTTPS push to a *separate* cloud Laravel instance is the planned next sprint — see [`docs/offline-fallback-verification.md`](../docs/offline-fallback-verification.md). In a single-site deployment (most Suriname customers), the dashboard and the back-office talk to the same database, so "sent" is genuinely "HQ has the data". In a future hub-and-spoke deployment, "sent" will mean "the cloud receiver acknowledged the row". The user-facing semantics are identical; the wire-level behaviour upgrades transparently.

---

## 11.4 The end-of-day flow, from cashier off-shift to "Sent ✓"

This is the full chain, told once end-to-end. Each step has its own chapter; this is the overview.

```
TRADING DAY ENDS
        │
        ▼
1. CASHIER on Kassa 1 closes their register     ─── POS user manual ch 3
        │    (counts cash, enters discrepancy note if any,
        │     register session is now closed)
        ▼
2. CASHIER on Kassa 2 closes their register     ─── same as above
        ▼
   (and so on for every till)
        │
        ▼
3. MANAGER opens the POS-side End of Day screen ─── POS user manual ch 10
        │    (POS top bar → Dagafsluiting / End of Day)
        ▼
4. MANAGER reviews today's summary
        │    (total sales, BTW, transaction count, payment split,
        │     cash totals — all derived from sales in the local DB)
        ▼
5. MANAGER counts the cash drawer(s) physically
        │    Enters actual cash. If it ≠ expected cash,
        │    fills in the mandatory discrepancy note.
        ▼
6. MANAGER clicks "Print Z-Report"              ─── POST /api/reports/z-report
        │    Backend:
        │      • Checks no z_reports row exists for (store_id, today)
        │        → if it does, returns 409 ALREADY_CLOSED
        │      • Computes day totals via buildDailySummary()
        │      • Inserts z_reports row with sync_status='pending',
        │        cash_discrepancy_srd = actual − expected,
        │        top_products + btw_breakdown as JSONB
        │      • Returns the new ZReport
        │    UI receives 201, prints the Z-Report slip
        │    (or offers PDF if no thermal printer).
        ▼
7. The row is now visible in the dashboard      ─── this screen
        │    Sync pill = amber "Pending".
        ▼
8. MANAGER clicks "Submit to HQ"                ─── POST /api/reports/z-report/{id}/submit
        │    Backend:
        │      • Permission check: z_report.submit
        │      • If already sent → 409 ALREADY_SENT
        │      • Updates sync_status='sent', synced_at=now()
        │      • Broadcasts ZReportSubmitted on the org channel
        │        (Laravel Reverb — the dashboard updates instantly)
        ▼
9. Sync pill flips to green "Sent ✓"            ─── dashboard updates live
        │    (live update via WebSocket; no refresh needed)
        ▼
   ☑ Day closed. The figure is now in the consolidated dashboard,
   the monthly BTW report, and the audit log.
```

For the **manager-side details** (which button, what message, what to do if the cash doesn't match), see [POS user manual ch 10](../user_manual/10-end-of-day.md). This chapter handles everything **after** step 6 — i.e. what HQ sees and what to do if anything goes wrong.

---

## 11.5 USB encrypted export — Layer 4, the offline lifeline

> _Screenshot placeholder: `dashboard_manual/screenshots/11-usb-import-panel.png`._

If a store's internet has been down all day and the submit-to-HQ call cannot reach the cloud, the manager has a fallback: **export the day's data to an encrypted file, carry it to HQ on a USB stick (or send it via WhatsApp or email), and let an Org Admin upload it through this dashboard screen**.

The data lands in HQ's database **exactly as if it had synced normally** — same sale IDs, same line items, same totals. The pipeline is idempotent: re-importing the same file twice imports zero duplicate rows.

### What's in the file

The `.josbin_pos` file is a binary envelope:

| Layer | Contents |
|---|---|
| Outer JSON | `{ hmac, cipher, version, data }`. Plaintext envelope so the import endpoint can validate before attempting decryption. |
| `data` (base64) | AES-256-CBC encrypted JSON. Key = `HMAC-SHA256(store_id, APP_KEY)`. IV randomly generated per export and prepended. |
| `hmac` (hex) | HMAC-SHA256 of the **plaintext** JSON, using the same key. Catches both tampering and wrong-key import attempts. |
| Plaintext payload (inside the encryption) | `version`, `format`, `generated_at`, `exported_by`, `organisation_id`, `store_id`, `store_name`, `period: {from, to}`, `record_count`, `total_srd`, `total_btw_srd`, `sales: [...]` (each with its `items: [...]`). |

The plaintext never leaves the back-office machine. What rides on the USB is only the AES envelope. **Safe to send via WhatsApp, email, USB, anything** — the file is useless to anyone without the back-office's APP_KEY *and* the matching store record on the other end.

### Manager-side export (at the offline store)

Step by step, from the manager at the back-office computer:

1. End of Day screen → 7-day history table → on the row of the day(s) that didn't sync, click the **💾 .josbin_pos** download button. (Detailed in [POS user manual ch 10 §10.6](../user_manual/10-end-of-day.md#106-what-to-do-if-sync-fails-status--failed-or-pending).)
2. The browser downloads `josbin_pos_<store-name>_<from>_<to>.josbin_pos`.
3. Manager copies the file to a USB stick, or attaches it to an email / WhatsApp to HQ.
4. Manager also notes (or HQ already knows) the **Store ID** for that branch — a UUID like `123e4567-e89b-12d3-a456-426614174000`. Without this, HQ can't decrypt the file.

The export endpoint is `GET /api/sync/export?store_id=<uuid>&from_date=YYYY-MM-DD&to_date=YYYY-MM-DD`. Source: `backend/app/Http/Controllers/Api/SyncExportController.php::export`.

### HQ-side import (at the Org Admin's desk)

> _Screenshot placeholder: `dashboard_manual/screenshots/11-usb-import-result.png`._

1. Dashboard → **Z-Rapporten / Z-Reports** screen.
2. Find the **💾 USB back-up importeren / Import USB backup** panel near the top — click to expand. It's labelled *"Noodgeval • Laag 4 / Emergency • Layer 4"* in amber.
3. Paste the offline store's **Vestiging ID (UUID)** into the field. (Get this from the offline store or from your Stores screen.)
4. Click the file input → pick the `.josbin_pos` file you received.
5. Click **Importeren / Import**.

What you'll see:

| Result | Meaning |
|---|---|
| Green banner with `N imported · M skipped` | Success. `imported` = new sales added. `skipped` = sales whose IDs already existed (idempotent — safe to re-import). |
| `Decryption failed. Wrong store or corrupted file.` | The Store ID you typed doesn't match the file. Double-check the UUID. |
| `File integrity check failed. The file may have been tampered with.` | HMAC mismatch. Either the file was modified in transit, or it was generated against a different APP_KEY (e.g. a sandbox install). Get a fresh export. |
| `Invalid .josbin_pos file format.` | The outer envelope is malformed. Probably a partial download; re-fetch the file. |

The import endpoint is `POST /api/sync/import` with `multipart/form-data` carrying `file` and `store_id`. Source: same `SyncExportController::import`. Backend size limit: 50 MB per file.

### What happens to the existing Z-Report row?

The import re-creates the underlying `sales` and `sale_items` rows with their original IDs. The `z_reports` row for that day **already exists locally** at the offline store — that row, however, never crosses the wire on a USB import (the export is sales-data, not Z-Report-metadata). So when you import USB-style:

- The day's individual sales now live in HQ's database.
- Consolidated reports (Ch 10) covering that date now include those sales.
- The HQ-side **Z-Reports screen** does **not** show a row for that day for that store — because no `z_reports` row was inserted at HQ. The store's local Z-Report still exists at the back-office.

This is a known asymmetry — see §11.10 — and the workaround is fine in practice: the data is what matters; the *fact* that the day was closed is captured in the back-office's z_reports table and in the cover page of the imported file.

---

## 11.6 The 5-layer offline fallback — honest status

The architecture promises five layers of redundancy between "internet works" and "manager carries USB sticks". Here's where each layer actually stands today.

| Layer | What it is | Status | Notes |
|---|---|---|---|
| **1 — Real-time sync** | Every individual sale pushed to cloud the moment it commits | **Scaffolded** | The data model supports it; no `synced_at` column on `sales` yet, no outbox table, no per-sale push job. In current single-site deployments this is implicit — the dashboard reads the same DB. |
| **2 — Auto retry with backoff (1m → 5m → 15m → 30m)** | Failed Layer-1 pushes retry on a schedule | **Scaffolded** | Depends on Layer 1's outbox. The `RecordStockMovements` job is the right pattern to model on — same shape, different payload. |
| **3 — Z-Report forced retry / submit-to-HQ** | Manager clicking Submit-to-HQ is a deliberate end-of-day sync attempt | **✅ Verified** | `POST /api/reports/z-report/{zReport}/submit` is wired, permission-gated, idempotent, broadcasts to the dashboard. See `submitZReport` source. |
| **4 — USB encrypted export** | AES-256 + HMAC `.josbin_pos` file, dashboard upload | **✅ Verified** | Both export and import endpoints work; roundtrip tested. The whole §11.5 flow above. |
| **5 — Catch-up sync every 60 s** | When internet comes back, push all queued days chronologically | **Scaffolded** | No scheduled `sync:catchup` command exists. Other scheduled commands (`rates:lock`, `license:check`) prove the harness works — adding catch-up is mechanical once Layer 1's outbox exists. |

For the demo and for client-facing claims today:

- **Lead with Layers 3 and 4.** These are the headline features and they work end-to-end.
- **Describe Layers 1, 2, 5 as "in the data model, cloud receiver and outbox shipping next sprint".** Don't oversell.

Reference: [`docs/offline-fallback-verification.md`](../docs/offline-fallback-verification.md) is the canonical "what works today" doc — keep it open when discussing the offline story with a customer.

### Mobile data fallback (4G dongle)

A 4G USB dongle (Digicel or Telesur) plugged into the back-office PC is the **secondary network path** for stores in the interior where wired internet is unreliable. This is **OS-level configuration**, not application behaviour — the Laravel app just sees "internet is reachable" or not. Sync payloads are tiny (50–200 KB per Z-Report), so a slow 4G connection handles a month of trade with room to spare.

When you're scoping a new install, the question to ask the customer is "where is the network drop, what's its uptime, and is there a backup 4G option?" — the answer determines how much you'll lean on Layer 4 in practice.

---

## 11.7 What the manager actually does (HQ side reference)

Concrete actions the dashboard user takes related to Z-Reports, with permission gates.

| Action | Permission | Screen | What it does |
|---|---|---|---|
| **View the Z-Reports list** | implicit (org-scoped) | Z-Reports & Sync | Read-only, filterable. |
| **See sync status of every closed day** | implicit | Z-Reports & Sync | One row per (store, date). |
| **Import a USB backup** | `sales.create` (held by Org Admin / Super Admin / Store Manager) | Z-Reports & Sync → USB panel | Re-derives the key from store_id, verifies HMAC, ingests sales. |
| **Export a USB backup for a store** | `view` on Store policy | Back-office direct call to `GET /api/sync/export` — currently a back-office action, not a dashboard one | Produces the `.josbin_pos` file. |
| **Close the day** (`z_report.close`) | manager+ (Store Mgr, Org Admin, Super Admin) | POS app → End of Day | Inserts the `z_reports` row with `sync_status='pending'`. |
| **Submit a Z-Report to HQ** (`z_report.submit`) | same set as above | POS app → End of Day → Submit to HQ button | Flips status to `sent`, broadcasts `ZReportSubmitted`. |
| **Review history (last 7 days)** (`z_report.view_history`) | cashier+ | POS app → End of Day → 7-day table | Read-only view of recent closes for the store. |

Cashiers don't close days — they close *register sessions*. The two are completely separate (§11.1).

---

## 11.8 Cash discrepancy — how it lands here

When the manager closes the day, the system computes:

```
discrepancy = actual_cash − expected_cash
            = (what the manager physically counted) − (opening floats + cash sales − refunds)
```

This is stored as `cash_discrepancy_srd` on the `z_reports` row. The discrepancy column in the dashboard table shows:

- **OK (green)** if `|discrepancy| ≤ SRD 0.005` (i.e. rounding-zero).
- **Red `−SRD x.xx`** if cash was **short**. Possible causes: counting error, missed refund, theft, or a sale that was rung up cash but paid card (no money in the drawer for it).
- **Amber `+SRD x.xx`** if cash was **over**. Usually a change-giving error in the customer's favour (the cashier gave too little change).

If the discrepancy is non-zero, the manager **must** type a `discrepancy_note` before the close-day call succeeds. That note is stored on the same row and visible in the audit log forever — see [Chapter 13 — Audit Log](13-audit-log.md).

You'll want to investigate any:

- Persistent shortfalls at one cashier — chase down the till sessions in the Registers screen (Ch 8) and look for the pattern.
- Large amber over-counts — these often signal a refund that wasn't recorded properly. Reconcile against the sales list for the day.
- Tiny rounding-style discrepancies — usually safe to ignore. SRD cash includes 5-cent and 10-cent pieces; over a busy day a few cents can drift either way.

The dashboard doesn't gate or block based on discrepancy size — that's a business policy decision. If you want a threshold beyond which the Z-Report needs a second manager's approval, that's roughly the "dual approval above SRD `<threshold>`" requirement that's policy-flagged for government departments (see [Chapter 1 §1.5](01-roles-and-permissions.md#15-special-rules-for-government-departments)). For commercial customers it's a vendor-support tunable, not exposed in the dashboard UI yet.

---

## 11.9 One Z-Report per store per day — the unique constraint

The `z_reports` table has a **unique constraint** on `(store_id, report_date)`. There can only ever be one Z-Report row for one store on one calendar date.

What happens if a manager tries to close the same day twice:

- POST `/api/reports/z-report` with the same `store_id` for today's date.
- Backend detects the existing row, returns:

```http
HTTP/1.1 409 Conflict
{
  "message": "De kas voor vandaag is al gesloten.",
  "code": "ALREADY_CLOSED",
  "z_report": { ... existing row ... }
}
```

The UI shows the user "Today is already closed" rather than creating a duplicate. The existing row is returned in the body so the UI can present its values (sync status, totals) — useful for the second-manager-checking-the-other's-work scenario.

Likewise, re-submitting an already-sent report returns:

```http
HTTP/1.1 409 Conflict
{
  "message": "Dit Z-rapport is al verzonden naar het hoofdkantoor.",
  "code": "ALREADY_SENT",
  "data": { ... existing row ... }
}
```

Both 409s are by design — preventing duplicate state changes from making a mess.

### What if a store really needs to "reopen" a closed day?

This is rare and almost always wrong. If a Z-Report was closed at 17:00 and a refund needs to be issued at 17:30, the right answer is to process the refund into the **next** trading day, not to "reopen" the previous day. The Z-Report is a legal-style audit boundary; reopening it would invalidate the BTW report, the consolidated dashboard, and any reports already filed.

The Registers screen ([Chapter 8](08-registers.md)) covers the **manager reopens a closed register session** flow, which is the lighter-weight version of this — and that one *is* designed for normal "the cashier closed too early" scenarios. Z-Report itself stays closed once closed.

If the underlying need is genuinely *"we have to back out a sale that was rung up wrong"*, that's a void/refund on the original sale row, which counts under the next day's reports. The original Z-Report's totals don't change; the void is documented in the audit log and the Rekenkamer export (see [Chapter 10 §10.6](10-reports.md#106-rekenkamer-export--the-court-of-audit-pdf)).

---

## 11.10 Roadmap and known asymmetries

Things this chapter glosses over because they're planned but not in the current release. Useful to know when scoping client expectations.

| Item | Current state | Planned |
|---|---|---|
| HQ-side "Submit to HQ" button on a `pending` / `failed` row | Not in this release — submit-to-HQ is currently triggered from the POS-side End of Day screen at the back-office. | Adding a per-row **Re-submit** action on the dashboard Z-Reports table is in the backlog. |
| HQ-side "Generate USB export" button | Export is currently called from the back-office (the manager's screen has the download). HQ can't currently *trigger* a fresh export. | A dashboard-side **Generate export for store X** action is planned for the case where the offline store is reachable by phone but doesn't know how to drive the download. |
| Real Layer-1 (per-sale push to a separate cloud receiver) | Scaffolded only. In single-site deployments dashboard + back-office share a DB, so "real time" is implicit. | Hub-and-spoke: separate cloud Laravel instance; per-sale `PushSaleToCloud` job; `sales.synced_at` column; outbox table. ~1 day of work per `docs/offline-fallback-verification.md`. |
| USB import does not create a HQ-side `z_reports` row | A USB-imported day shows up in consolidated reports (sales are present) but doesn't show up in the HQ Z-Reports list (no z_reports row was carried). | Future: include the `z_reports` metadata in the export envelope, materialise it on import. Low priority — the financial data is what matters; the Z-Reports list is a sync-visibility tool. |
| Digital signature on Rekenkamer PDF | SHA-256 document hash on every page + in response header. | Full PKCS#7 PDF signature with the organisation's signing certificate. Lands with the org-cert infrastructure. See [Chapter 10 §10.6](10-reports.md#106-rekenkamer-export--the-court-of-audit-pdf). |
| Discrepancy threshold for dual approval | Single-approver close, no threshold gating. | Configurable threshold above which a second manager's approval is required to close the day. Government policy implies it; commercial customers can opt in. |

When in doubt, the canonical source is [`docs/offline-fallback-verification.md`](../docs/offline-fallback-verification.md). It's a single-page honest snapshot — read it before promising anything live to a customer.

---

## 11.11 Troubleshooting

| Symptom | What's going on | What to do |
|---|---|---|
| Today's row is missing for a store | The manager hasn't clicked **Close day** yet — the day is still open. | Wait. Or call them. The day's *sales* are still in the consolidated report (they read from `sales`, not from `z_reports`). |
| Row is amber `Pending` and has been for hours | The manager closed but didn't click **Submit to HQ**. In single-site deployments, also normal — the broadcast happens on Submit. | Have the manager open End of Day on the POS, find the day in the 7-day history, click Submit. |
| Row is red `Failed` | The submit call attempted and errored. (In the current release, this state is rare — the simple flip-flag flow doesn't fail. Persistent failed rows usually indicate a manual DB tweak or a broken broadcast.) | Investigate via the back-office Laravel log. Re-submit from the POS-side End of Day screen. |
| Sync filter set to "Pending" shows yesterday's rows | Yesterday's day(s) never got Submit-to-HQ'd. | Have each store's manager submit. Or USB-import (§11.5). |
| `409 ALREADY_CLOSED` when closing the day | This day is already closed. (Refresh the End of Day screen to see the existing row.) | Don't try to close twice. If you need to add a missed sale, ring it up today — it counts in today's Z-Report. |
| `409 ALREADY_SENT` on submit-to-HQ | The row already shows `sync_status = sent`. Either someone already clicked it, or the local DB already reflects a previous sync. | Nothing to do — the data has reached HQ. |
| USB import returns "Wrong store or corrupted file" | The Store ID you typed doesn't match the file's encrypted-key derivation. | Get the correct Store ID from the Stores screen. UUID, not the store name. |
| USB import returns "File integrity check failed" | HMAC mismatch — file was modified, or it was generated by a different APP_KEY (e.g. a sandbox install talking to a production dashboard). | Get a fresh export. Confirm both ends are on the same release. |
| Consolidated dashboard total < sum of per-store back-office reports | One or more stores are offline and haven't synced. | Z-Reports screen → filter Pending — that's the list. Have them submit, or USB-import. |
| Two managers tried to close the day at once | The unique constraint blocks the second one with `409 ALREADY_CLOSED`. | Only one of them should close. Decide who, and the other watches from the dashboard. |
| The dashboard's "Sent ✓" pill shows but the consolidated report still doesn't include the figures | Refresh the consolidated tab. The Reports screen doesn't auto-refresh; the Z-Reports screen does. | Just refresh. |

---

## 11.12 Quick reference

```
DAILY HQ HABIT                     Z-Reports & Sync → check Pending = 0 from yesterday
                                                    → check Failed = 0 always

WHEN A STORE IS STUCK              Z-Reports & Sync → expand USB import panel
                                                    → paste Store ID + .josbin_pos file
                                                    → Import

PERMISSION CHEAT SHEET
  z_report.close          manager+   close the day from the POS
  z_report.submit         manager+   click "Submit to HQ"
  z_report.view_history   cashier+   read-only view of recent closes
  (USB import)            org admin+ via Z-Reports screen

KEY ENDPOINTS
  POST /api/reports/z-report                       open + close a day's Z-Report
  POST /api/reports/z-report/{id}/submit           submit to HQ
  GET  /api/reports/z-report/history?store_id=…    last 7 days for one store
  GET  /api/dashboard/z-reports                    HQ-side list with filters
  GET  /api/sync/export?store_id=…&from=…&to=…     download .josbin_pos
  POST /api/sync/import                            upload .josbin_pos at HQ

SYNC STATES
  pending  → amber  → "closed locally, not yet pushed"
  sent     → green  → "HQ has it"  (some payloads display this as "synced")
  failed   → red    → "push attempted and errored"
  never    → grey   → "no sync ever attempted" (rare/legacy)

REMEMBER
  • One Z-Report per store per day (unique constraint).
  • Discrepancy ≠ 0 requires a note. The note is permanent in audit log.
  • Cashier close ≠ Z-Report. See §11.1.
  • USB import is idempotent — re-uploading the same file is safe.
```

---

## 11.13 Cross-references

- **Cashier register-session close** — [POS user manual ch 3](../user_manual/03-register.md). The per-shift close that is **not** a Z-Report.
- **Manager End of Day workflow on the POS** — [POS user manual ch 10](../user_manual/10-end-of-day.md). The step-by-step from the manager's perspective.
- **Reports that read closed-day data** — [Chapter 10 — Reports](10-reports.md). The analytical side; this chapter is the operational side.
- **Audit log entries for closes + submits** — [Chapter 13 — Audit Log](13-audit-log.md) *(coming soon)*.
- **Registers — physical till management + reopen-session workflow** — [Chapter 8 — Registers](08-registers.md) *(coming soon)*.
- **Roles & permissions** — [Chapter 1 — Roles & Permissions](01-roles-and-permissions.md).
- **Honest status of each fallback layer** — [`docs/offline-fallback-verification.md`](../docs/offline-fallback-verification.md). Keep this open during demos.
- **Developer-side data model** — [`docs/06-register-and-z-report.md`](../docs/06-register-and-z-report.md) (planned), [`docs/07-sync-and-offline.md`](../docs/07-sync-and-offline.md) (planned).

---

→ Next: [Chapter 12 — API integrations & webhooks](12-api-integrations-and-webhooks.md) *(coming soon)*
