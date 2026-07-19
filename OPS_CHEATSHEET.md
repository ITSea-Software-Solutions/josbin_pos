# OPS CHEATSHEET — the five moves that keep Josbin POS alive

> INTERNAL (srcExcluded; served only behind the password on /internal/).
> For the partner ops person: the minimum needed to keep the platform
> healthy **without the original developer**. You need: SSH access to the
> server (key in the password manager — HANDOVER §3), and the dashboard
> Super Admin login + its TOTP (also in the password manager). Comfortable
> with a terminal is enough; nothing here requires writing code.
>
> Cloud server: **142.93.88.143**, repo at `/var/www/html`. A store's local
> back-office PC runs the same stack (repo at `C:\josbin`, commands via
> WSL/Git-Bash, URL `http://192.168.0.250:8080`) — every move below works
> there too with those paths swapped. Deeper background: `FIELD_RUNBOOK.md`
> (installs) and `HANDOVER.md` (infra map).

---

## Move 1 — Health check (is everything up?)

**When to do this:** start of every check-in (weekly, or daily during a
pilot), after any server reboot, and whenever anyone reports "it's slow /
it's down".

1. From your own machine, probe the API:
   ```bash
   curl -s http://142.93.88.143:8080/api/health
   ```
2. Probe the four web ports (each should print `200`):
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://142.93.88.143:8080/api/health   # backend API
   curl -s -o /dev/null -w "%{http_code}\n" http://142.93.88.143:8090/            # Super Admin dashboard
   curl -s -o /dev/null -w "%{http_code}\n" http://142.93.88.143:8091/            # POS web app
   curl -s -o /dev/null -w "%{http_code}\n" http://142.93.88.143:8095/            # docs site
   ```
   (Two more exist: `6001` WebSocket for live dashboard tiles, `8443`
   dashboard over TLS. If the four above are green those almost always are.)
3. On the server, list the containers:
   ```bash
   ssh root@142.93.88.143
   cd /var/www/html
   docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.frontends.yml ps
   ```

**What good looks like:** step 1 returns HTTP 200 with `"status":"ok"` and
four checks all ok — `database`, `redis`, `queue_workers` (Horizon), `disk`
(free space; warning under 500 MB, critical under 100 MB). Step 3 shows
every container `Up` — the full list (nginx, app, dashboard, POS web, docs,
Reverb, postgres, pgbouncer, redis, horizon, scheduler) is in HANDOVER §2.

**If it fails:**
- `"status":"degraded"` / HTTP 503 → the JSON tells you *which* check is
  red. Read the last errors:
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.frontends.yml logs --tail 50 app
  ```
- A container missing from `ps` → bring the stack back up (safe, idempotent):
  ```bash
  docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.frontends.yml up -d
  ```
- Ports unreachable from *your laptop* but fine from the server
  (`curl http://localhost:8080/api/health` over SSH works) → known
  DigitalOcean cloud-firewall issue on the 8xxx ports (HANDOVER §2); the
  fix is inbound TCP rules in the DO panel, not on the server.
- Still red after `up -d` + logs → send the health JSON and the last 50 log
  lines to the developer. Do not experiment further on a production box.

---

## Move 2 — Did last night's backup run?

**When to do this:** every check-in, and always the morning after big
imports or a go-live. Backups run automatically at **03:30 AST** via cron
(`/var/www/html/scripts/backup.sh`) — this move just verifies they really
happened.

1. ```bash
   ssh root@142.93.88.143
   ls -lth /var/backups/josbin/db/ | head -4
   ```
2. Freshness: the newest `josbin-YYYYMMDD-0330.dump` must be dated **this
   morning ~03:30**. Naming is `josbin-<date>-<time>.dump`; 14 daily dumps
   are kept, older ones are pruned automatically.
3. Size sanity: today's dump should be roughly the same size as yesterday's
   or slightly larger (the `ls -lth` listing shows both). A sudden shrink to
   a few KB means a broken dump — treat as failure.
4. Read the log tail — expect `dump ok: josbin-….dump (<size>)` and
   `backup done` with today's date:
   ```bash
   tail -n 20 /var/backups/josbin/backup.log
   ```
5. Weekly (Sundays) a base snapshot is also written — check it exists and
   that WAL files keep arriving (these enable minute-level point-in-time
   recovery):
   ```bash
   ls -lth /var/backups/josbin/base/ | head -3     # base-….tar.gz, 2 kept
   ls -lt  /var/backups/josbin/wal/  | head -3     # segments with recent dates
   ```
6. Monthly, pull an off-site copy to the office laptop (kept in
   `~/JosbinBackups`, 10 retained):
   ```bash
   ./scripts/pull-backup.sh
   ```

**What good looks like:** a dump from this morning, size in line with
previous days, `backup done` in the log, WAL directory receiving files.

**If it fails:**
- No dump from last night → run it by hand and watch the output:
  `bash /var/www/html/scripts/backup.sh`
- Check the schedule still exists: `crontab -l` must contain the
  `30 3 * * * /var/www/html/scripts/backup.sh …` line.
- Disk full is the classic cause — Move 1's health JSON shows `disk`.
- Manual run also fails → copy the error output and call the developer
  **the same day**. A platform without a fresh backup is the one situation
  that cannot wait.

---

## Move 3 — Restore drill (prove the backups actually restore)

**When to do this:** **monthly**, and after any PostgreSQL upgrade.
Untested backups are not backups. The drill is **non-destructive**: it
restores the newest dump into a scratch database, compares row counts with
the live database, then deletes the scratch copy. Live data is never
touched.

1. ```bash
   ssh root@142.93.88.143
   bash /var/www/html/scripts/backup-restore-test.sh
   ```
2. Watch the output (takes well under a minute on current data volumes).

**What good looks like** (counts will differ — the pattern matters):

```
Restoring josbin-20260719-0330.dump into scratch DB 'josbin_restore_test'…
  ok   sales: restored=1284 live=1291
  ok   sale_items: restored=3512 live=3530
  ok   products: restored=214 live=214
  ok   organisations: restored=3 live=3
  ok   audit_logs: restored=9821 live=9860
  ok   z_reports: restored=118 live=118
RESTORE DRILL PASSED — josbin-20260719-0330.dump is a usable backup.
```

Restored counts may lag live slightly (the shop kept selling after 03:30) —
that is normal. They must never *exceed* live.

**If it fails:**
- `NO DUMPS FOUND in /var/backups/josbin/db` → last night's backup never
  ran; do Move 2's failure steps first, then re-run the drill.
- `RESTORE DRILL FAILED — investigate before trusting backups` → do **not**
  ignore or postpone this. Re-run once; if it fails again, call the
  developer the same day with the full output. Until it passes, treat the
  platform as having no usable backup.

---

## Move 4 — Issue / renew a licence

**When to do this:** new customer signed (issue), a renewal request appears
as *"In behandeling / Pending"*, or the licence screen shows orange/red
urgency (≤14 days or expired). The dashboard warns from 30 days out — this
move exists so no customer ever hits a lock unnoticed.

> Today the in-dashboard path is the live one — the separate License Server
> app exists in the repo but is not deployed yet (HANDOVER §2), so all
> issuing and renewing happens on this screen.

1. Open `http://142.93.88.143:8090` → log in as **Super Admin** (password
   manager; TOTP code required).
2. Sidebar → **Licentiebeheer** (License Management) — Super Admin only.
3. Check the stats strip: *Totaal / Actief / Verlopen / Kritiek*
   (Total / Active / Expiring ≤14d / Critical). Anything in the last two
   buckets is your work queue.
4. **Issue a new licence:** click **+ Nieuwe licentie** (Issue license) →
   pick the Organisation, Tier (Standard / Professional / Enterprise), set
   **Max. vestigingen** (max stores) and **Max. terminals**, set validity
   (defaults: today → +1 year) → **Licentie uitgeven** (Issue license).
5. **Renew / extend:** find the organisation's row → pencil **Edit** icon →
   set the new **Geldig tot** (Valid until) date → save. This is the real
   extension. (The customer's own *Vernieuwen / Renew* button only files a
   request — it flips the row to *"In behandeling / Pending"* for you to
   process this way. Confirm payment first.)
6. **Deactivate** (customer off-boarding): bin icon on the row — stops
   enforcement, keeps the row for the audit trail.
7. Verify: the row's urgency badge returns to green, banners disappear, and
   the action appears in the audit log. The customer needs **no reinstall
   and no new key** — the change is picked up automatically.

**What good looks like:** stats strip shows 0 critical; no rows stuck in
*Pending*; the customer's banner is gone at their next dashboard load.

**What the customer sees if a licence is NOT renewed** (so you can answer
their call calmly): 30 days out a yellow banner; 14 days out an amber
banner (daily e-mail reminders are wired but only deliver once SMTP is
configured — the in-app banner is the source of truth); on the expiry date
a red banner and a **14-day grace period — the POS keeps selling,
cashiers are unaffected**. After grace: **soft lock** — new sales are
blocked but all data, reports and exports remain available. 30 days later:
**hard lock** — login blocked, data-export tools remain for 90 days.
Renewal at any point clears it instantly.

**If it fails:**
- No *Licentiebeheer* in the sidebar → you're not logged in as Super Admin.
- A store creation is refused with "License limit reached"
  (LICENSE_STORE_LIMIT_REACHED) → raise **Max. vestigingen** via Edit on
  the licence row.
- Customer reports still-locked after your renewal → have them log out and
  back in; if it persists, call the developer.
- Full background (tiers, hardware fingerprints, off-boarding):
  dashboard manual chapters 15 and 16.

---

## Move 5 — Import a product catalogue

**When to do this:** a new store's first product load, a supplier price
refresh, or migrating a customer off another POS. One upload replaces hours
of clicking; the importer is safe to re-run (rows match on barcode).

1. Dashboard (`http://142.93.88.143:8090`) → log in as the customer's
   **Organisation Admin** (or Super Admin).
2. Sidebar → **Import / Export** (under the Catalogue section).
3. Safety net first: click **Catalogus exporteren (.csv)** (Export
   catalogue) and keep the file — it is your one-click undo.
4. Click **CSV-sjabloon** (CSV template) or **Excel-sjabloon** (.xlsx) →
   open it in Excel → **delete the 3 example rows**.
5. Fill your products. Rules that matter:
   - `name_nl` is the **only required column** (headers are case-sensitive,
     row 1).
   - `barcode` is the match key: existing barcode → updates that product;
     new barcode → creates one; **blank barcode → creates a duplicate on
     every re-upload**, so always fill it.
   - Prices with a decimal **point** (`12.50`, never `12,50`); `btw_rate`
     defaults to 10; `btw_exempt` = `1` for exempt basics.
6. Save as **CSV UTF-8** or `.xlsx` (max 10 MB) and drag the file onto the
   drop zone.
7. Check the preview badges: `✓ N geldig` (valid) / `✗ N met fouten` (with
   errors). Hover the warning icons to see per-row problems.
8. Click **N rijen importeren** (Import N rows).
9. Read the result banner: `X aangemaakt · Y bijgewerkt · Z overgeslagen`
   (created / updated / skipped) — expand the error list for row numbers of
   skipped rows.
10. Spot-check one product on a till — updates reach the terminals within
    seconds over the WebSocket (the **📡 Catalogus pushen** button on the
    Catalogue screen forces a refresh for a till that was offline).

**What good looks like:** counts match your expectation — a pure price
update shows **0 aangemaakt** (0 created); new products appear on the POS
grid immediately.

**If it fails — the common one is wrong columns:**
- `⚠ Missing required column: "name_nl"` → header typo. It must be exactly
  `name_nl` (lower-case, underscore). Fix row 1, re-drop.
- Created-count high when you expected updates → the `barcode` column was
  missing/blank, so every row made a *new* product. Deactivate the
  accidental duplicates (Catalogue → filter by today) and re-import with
  barcodes filled.
- Accents look like `MozaÃ¯ek` → file saved as ANSI. Re-save as **CSV
  UTF-8** (or use the Excel template).
- Prices imported as `12` → comma decimals; use `12.50`.
- `.xlsx` rejected with "Could not read file" → password-protected or
  macro (`.xlsm`) file; re-save as plain `.xlsx`.
- Anything else: screenshot the error banner + keep the file, call the
  developer. The full column reference and mistake table: dashboard manual
  chapter 5.
