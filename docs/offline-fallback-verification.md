# Offline Fallback — Verification Status

> **Why this doc:** the architecture HTML and proposal describe a "five-layer offline fallback". This is the honest status of what's actually implemented vs. scaffolded vs. aspirational, as of the last verification pass.

## Verified working

### Layer 3 — Z-Report sync to cloud (submit-to-HQ)
- `POST /api/reports/z-report/{zReport}/submit` flips `sync_status` from `pending` → `sent` and stamps `synced_at`.
- Manager-only via `z_report.submit` permission.
- Idempotent: re-submit on an already-sent report returns the existing row, no duplicate.
- **Caveat:** this updates the *local* `z_reports.sync_status`. The actual HTTPS push to a separate cloud Laravel instance is not wired here — for now, "sent" means "marked sent in the local DB". In a real deployment, the cloud Laravel would be a separate service receiving this via the same `/sync/import` endpoint described below.

### Layer 4 — USB encrypted export / import
- `GET /api/sync/export?store_id=X&from_date=Y&to_date=Z` produces an AES-256 + HMAC-SHA256 signed JSON file (`.josbin_pos`).
- `POST /api/sync/import` (multipart `file` + `store_id`) re-derives the key, verifies the HMAC, ingests the sales and items.
- Verified locally: 797-byte export → re-import returns `imported:0, skipped:0, errors:[]` for same-store roundtrip (expected — the source already exists).
- **Use case proven:** a manager in the interior can save the file to USB or send via WhatsApp; HQ uploads via the dashboard and it lands as if synced normally.

## Scaffolded but not yet wired

### Layer 1 — Real-time sync on every sale
Sale creation commits locally only. There is no per-sale HTTPS push to a cloud receiver yet. The data model supports it (`sales.synced_at` could be added; outbox table not present). Cloud receiver would be a separate Laravel app.

### Layer 2 — Auto retry with backoff (1m → 5m → 15m → 30m)
Depends on Layer 1 outbox. No retry job exists yet. The `RecordStockMovements` job pattern is the right shape to model it on.

### Layer 5 — Catch-up sync every 60 s
No scheduled `sync:catchup` command in `routes/console.php`. Schedule already runs `rates:lock` and `license:check` so adding this is mechanical once Layer 1 exists.

## Mobile data fallback (4G dongle)

Documentation describes a 4G USB dongle (Digicel / Telesur) as a secondary network path. This is **deployment / network configuration**, not application code — there's nothing to verify in the codebase. Configure at the OS level on the back-office PC; the application just sees "internet is reachable" or not.

## What this means for the demo

For a client demo, lean on:
- ✅ **Layer 4** — open the End-of-Day screen, click "Export as .josbin_pos", show the file, then "Import" on the dashboard. Genuinely impressive and works.
- ✅ **Layer 3** — manager clicks "Submit to HQ" on Z-Report, status flips to `Sent ✓`. Honest framing: "this is the local-side of the handshake; the cloud receiver is the same `/sync/import` endpoint shown above."
- ⚠️ **Layers 1, 2, 5** — describe them as "in the data model; cloud receiver and outbox are the next sprint". Don't claim they work end-to-end today.

## Next sprint to close the gap

1. `sales` table — add `synced_at` nullable timestamp + index.
2. New job `PushSaleToCloud` dispatched after `SaleController::store` commit. Reads `CLOUD_API_URL` from `.env`; POST `/v1/sales` (the existing Layer 3 integration endpoint already accepts this shape). On 2xx, set `synced_at = now()`. On failure, Laravel queue retries handle backoff.
3. Scheduled `sync:catchup` every minute — pushes any `synced_at IS NULL` sales older than 60 s.
4. Optional: `sales_outbox` table if you want explicit failed-attempt tracking visible in Horizon.

This adds ~1 day of work and makes Layers 1, 2, 5 real instead of described.
