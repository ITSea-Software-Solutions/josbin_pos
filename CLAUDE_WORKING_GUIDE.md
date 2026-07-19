# Josbin POS — Working Guide

> **Audience:** Claude (current session + future sessions) and human teammates.
> **Purpose:** The *how we work* doc — not the *what the product is* doc.
> **Companion file:** [CLAUDE.md](CLAUDE.md) holds the product spec, tech stack, requirements. This file holds engineering discipline, cross-surface checklists, gotchas we've actually hit, and operational practices.
> **Living document.** Every time we discover a new gap or pattern, add it here. Never delete — strike-through outdated notes so future-me sees the evolution.

---

## §0 How to use this doc

**Starting a session?** Skim §1 (mental model), §2 (surfaces checklist), and the most recent entries in §4 (gotcha registry) and §10 (changelog). 5 minutes.

**About to declare a task done?** Walk §2 and §3 first. Every time.

**Hit a weird bug?** Check §4 — we've probably hit it before. If not, add it after fixing.

**Designing a new feature?** Walk §3 end-to-end journeys to see which roles/surfaces touch it.

---

## §1 Mental model

### The three-layer platform
1. **POS** — React 19 + Electron (Windows) / Capacitor (Android). Cashier rings up sales at a till. Runs offline. Lives in `frontend/`.
2. **Dashboard** — React 19 + Vite (web). HQ/manager admin. Lives in `dashboard/`.
3. **Open Integration API** — REST + webhooks. Third-party POS systems push sales in. Same Laravel app, different routes (`/api/v1/...`).

All three talk to one Laravel 13 backend in `backend/`. Three stacks (demo / live / sandbox), port-shifted, isolated DBs.

### The six roles, in order of authority
```
super_admin (us, the vendor)
  └── organisation_admin (HQ catalogue + users + stores within one org)
        └── store_manager (runs ONE store)
              └── cashier (rings up sales at ONE store)
        └── auditor (read-only, org-wide — Rekenkamer / internal accountant)
        └── api_integration (machine account for external POS systems)
```

**Key rule (learned the hard way):** cashier + store_manager are **strict 1:1 to a single store** via `users.store_id`. The other four are **org-scoped** and ignore `store_id`. There is no multi-store assignment and no "all stores in org" implicit grant. If someone works two shops, create two accounts.

### The user journey (memorise this — most cross-surface bugs hide in transitions between these steps)
```
1. Vendor (us)                  →  SA creates Organisation
                                →  SA creates OA account
                                →  SA issues Licence for that org   ← LICENCE GATE
                                                                       (added 2026-05-26)
2. OA logs in                   →  reads read-only org header
                                →  creates Stores (blocked if no licence)
                                →  imports catalogue (CSV/Excel)
                                →  creates Store Manager + Cashier accounts
                                                                     ← STORE PIN
                                                                       (must pick exactly one store)
3. Store Manager logs in        →  manages their assigned store
                                →  closes Z-Report at end of day
                                →  approves refunds
4. Cashier logs into POS        →  auto-routed to their one store
                                →  opens register (cash float)
                                →  rings up sales
                                →  closes register / hands off to next shift
```

If you can't recite this from memory, walk it in the actual dashboard before touching code.

---

## §2 The Surfaces Checklist — read before declaring "done"

Every feature touches multiple surfaces. Miss one and someone's flow breaks. This is the discipline we keep relearning.

For **every** non-trivial change, tick each surface below or write "n/a" with a reason:

```
☐ Backend route                   — routes/api.php
☐ Backend controller              — app/Http/Controllers/Api/*
☐ Backend policy / authz          — app/Policies/* + role checks in controller
☐ Backend model / migration       — app/Models/* + database/migrations/*
☐ Backend tests                   — tests/Feature/* with `test_` prefix
☐ Backend audit log               — does this action need an audit_logs row?
☐ POS frontend (frontend/)        — types, api client, screens, store, i18n
☐ Dashboard (dashboard/)          — types, api client, screens, route table, sidebar
☐ Shared types in sync            — backend response shape ↔ TypeScript interface
☐ Demo seeder                     — does demo data exercise this path?
☐ POS user manual                 — user_manual/*.md
☐ Dashboard manual                — dashboard_manual/*.md
☐ README + CLAUDE.md              — only if dev workflow / quick-start changes
☐ Smoke test                      — scripts/smoke-test-demo.sh probes the new endpoint?
☐ Live-walked the change          — opened the actual UI, did the actual user action,
                                    not just curled the happy path
```

### Why each one matters (with examples we've actually hit)

- **Demo seeder** — we added the licence gate but forgot to issue a demo licence. The OA flow broke instantly on next demo reset. (2026-05-26)
- **Both manuals** — multi-store pivot got documented in dashboard manual but user_manual still said "every store you have access to". Cashier doc lied. (2026-05-26)
- **Live-walked** — I kept fixing one screen, declaring done, and the user kept finding the next screen broken. *"if we do something at one place that impact should be on other places too"* — direct quote, 2026-05-26.
- **Shared types** — backend went from `store_ids[]` to `store_id` string but the TypeScript interface still said `store_ids?: string[]`. tsc passed because the field was optional. Browser showed `undefined`. (2026-05-26)

### The cross-surface display lens (added 2026-05-26, see G-012)

After you've added a new fact to the system, ask: **"would a user expect to see this in N other places too?"** Walk the four related views:

1. **The list view** for entities of this type ("show me all X")
2. **The detail view** for *one* such entity ("tell me about this X")
3. **The dashboard / overview** that summarises across entities
4. **The audit log** that records changes

Example: adding "license expiry" → shows on Licenses screen *and* on Stores screen banner *and* on SA Users list (so SA knows which OA's org is about to expire) *and* on audit log when issued / renewed.

### One golden rule

> **The user's role is not your role.** Build it, then open an incognito window, log in as the actual end-user (cashier, OA, manager), walk through the feature using only their UI. Found a gap? Fix and repeat.

---

## §3 End-to-end journeys to walk

These are the "if you change anything in this area, walk this journey" maps. Take 5 minutes; save hours.

### Journey A — New organisation onboarding (most common, most fragile)
```
SA login (admin@josbin-pos.sr)
  → Dashboard → Organisations → Add new org
  → Users → + Add → role: organisation_admin → assign to new org
  → Licenses → + Issue → pick org, tier, valid_until
  → Copy credentials, share with client

OA login (orgadmin@dehoop.sr)
  → Dashboard → reads read-only org header
  → Vestigingen / Stores → check licence banner shows correctly
  → + Nieuwe vestiging  ← must work
  → Catalogue → + Product manually (or bulk import)
  → Users → + Add → role: cashier → pick store from dropdown
  → Users → + Add → role: store_manager → pick store from dropdown
  → Catalogue → 📡 Push to POS

Manager login (manager@dehoop.sr)
  → POS auto-routes to their store (single store, no picker)
  → Open Register screen visible
  → Settings → System → Restart button visible (Manager+ gated)
  → Z-Report tab → 7-day history visible

Cashier login (kassa@dehoop.sr)
  → POS auto-routes to their store (no Store Selection screen)
  → Open Register → enter opening float
  → Ring up a sale (mixed BTW rates)
  → Pay cash → cash drawer pulse → receipt prints
  → Process a refund (manager approval modal)
  → My Account → My Performance / My Shifts visible
  → Logout
```

If any of those steps surprises you (extra screen, missing screen, error toast), that's a bug.

### Journey B — Z-Report close + sync
```
Cashier login → close register (cash count) → discrepancy note if mismatch
Manager login → Z-Report tab → Close Z-Report (one-way for today)
              → 7-day history shows today as "Closed ✓"
              → Submit to Headquarters → status flips to "Sent ✓ [timestamp]"
              → Re-submit if offline → queues, retries on reconnect

SA login → Dashboard → today's totals reflect the new sales
        → Audit Log shows: register.opened, sale.created (×N), register.closed,
          z_report.closed, z_report.submitted
```

### Journey C — Licence lifecycle
```
SA → Licenses → + Issue → standard tier, max_stores=2, valid 30d
OA → Vestigingen → licence banner shows "Standard · Active · valid_from→until"
OA → tries to add a 3rd store → button disabled, banner shows "limit reached"
   → API would return 422 LICENSE_STORE_LIMIT_REACHED
SA → Licenses → bump max_stores to 5
OA → refresh → banner updates, button enables

SA → Licenses → set valid_until to yesterday
OA → refresh → banner shows "Grace" / "Soft-lock" depending on days past
   → try to add store → 422 LICENSE_EXPIRED with the dates in the message
```

---

## §4 Gotcha registry

Real bugs we've hit. Each entry: what bit us, why, how to avoid.

### Stack & environment

#### G-001 (2026-05-26) Dashboard talks to wrong backend
**Symptom:** Login from http://localhost:5174 silently fails / hangs.
**Cause:** `npm run dev` was started without `VITE_API_URL`. Defaults to `http://localhost:8080` (live), but only the demo stack on `:8082` was up.
**Fix:** Always start via `bash scripts/dev.sh up` (sets env per `JOSBIN_STACK`). Or pass `VITE_API_URL=http://localhost:8082/api` explicitly.
**Lesson:** Wherever Vite is involved, the proxy target must come from env, not a hardcoded port.

#### G-002 (2026-05-26) Demo DB silently emptied
**Symptom:** Login returns "credentials do not match" against demo backend that was working an hour ago.
**Cause:** Something wiped `josbin_pos_demo` (volume reset, manual `migrate:fresh`, or a `docker compose down -v` somewhere).
**Fix:** `docker exec josbin_demo_app php artisan db:seed --force` reseeds idempotently.
**Lesson:** Need a `dev.sh doctor` probe. Until then, when demo login fails: check `SELECT count(*) FROM users` first.

#### G-003 (2026-05-26) Reverb on wrong port causes dashboard reload loop
**Symptom:** Dashboard reloads every few seconds; console shows `/broadcasting/auth ECONNREFUSED`.
**Cause:** Reverb runs on 6001 (live) or 6002 (demo). Hardcoded was 6001.
**Fix:** `dashboard/vite.config.ts` now derives Reverb port from `VITE_API_URL` (`:8082` → `:6002`).

#### G-031 (2026-07-06) Glued Blade directives never compile — `word@else` is literal text
**Symptom:** `GET /api/reports/export` 500'd on **every** request — "syntax error, unexpected end of file, expecting elseif or else or endif" — since the **initial commit**. Same defect sat latent in all four report PDF templates (`summary`, `consolidated`, `btw_consolidated`, and ~30 sites in `rekenkamer`).
**Cause:** Blade's directive regex starts with `\B@`. When `@` is preceded by a word character (`t/m@else to@endif`, `Kassa@else Cashier@endif`), the position before `@` IS a word boundary, so `\B` fails and the directive is left as literal text — while the line's leading `@if` (preceded by `)` or whitespace) compiles fine. Result: an unclosed `if:` and a fatal at render. Verified empirically: `Blade::compileString("@if(true)t/m@else to@endif")` → `<?php if(true): ?>t/m@else to@endif`.
**Why it survived for months:** zero feature tests rendered any PDF. The blades "looked right", the routes existed, FEATURES said ✅ — nothing ever executed the template. Even the same-day G-030 review sweep rewired `summary.blade.php`'s data keys and recorded the export as fixed — but the template *still* didn't compile, because nothing rendered it to check. On top of the compile failure, the frontend put a session token in the export URL (which P0-5 rightly ignores → the browser flow 401'd before it could even 500) — independent breaks, all invisible without one end-to-end render.
**Fix:** space before every `@else`/`@endif` that followed a word character (a compile-lint sweep of all 11 blades with the standalone `BladeCompiler` + `php -l` confirmed clean); export params now mirror each JSON sibling endpoint (monthly takes `year&month` — what the POS Monthly tab actually sends); `type=btw` is a clean 422 until SPOS-209 ships; `RekenkamerController` no longer compact()s an undefined `$paymentBreakdown`; POS button uses the `openReceiptPdf` authenticated-blob pattern. `ReportPdfExportTest` (7 tests) renders all four PDF endpoints and asserts 200 + `application/pdf` + `%PDF` magic bytes; the smoke script probes all four.
**Lesson:** never butt a Blade directive against the preceding word — `word@else` is invisible to the compiler and to your eyes. And any Blade→PDF (or Blade→anything) render path needs at least one feature test that actually renders it: a template that has never been executed is untested code wearing a ✅ — a review that "fixes" it without rendering it just repaints the ✅.

### Database & migrations

#### G-004 (2026-05-26) `sale_number` collision across stores
**Symptom:** Second store's first sale fails with unique-constraint violation.
**Cause:** Global unique constraint on `sales.sale_number`. Sale numbers are per-store sequences.
**Fix:** Migration `2026_05_26_000001_make_sale_number_unique_per_store` switched to composite unique `(store_id, sale_number)`.
**Lesson:** When a column "is per-X", the unique constraint must be composite.

#### G-005 (2026-05-26) PHPUnit uses SQLite by default but schema requires Postgres
**Symptom:** Tests fail with "no such function: gen_random_uuid" or pg_advisory_xact_lock errors.
**Fix:** `backend/.env.testing` points at `josbin_pos_test` in the same Postgres container.
**Lesson:** Never `--in-memory` SQLite when the production schema uses Postgres-specific features (uuid, pgvector, advisory locks).

#### G-006 (2026-05-26) `/** @test */` annotation not discovered
**Symptom:** Test file looks fine, but `php artisan test` reports 0 tests.
**Cause:** Project config requires the `test_` method prefix; PHPUnit annotation is ignored.
**Fix:** Rename methods to `test_snake_case`.

### Business logic

#### G-007 (2026-05-26) "No licence = allowed" loophole
**Symptom:** OA could create unlimited stores before SA issued a licence. User caught this manually: *"so OA can not create store without licence ? or i am missing anything in flow ?"*
**Cause:** `OrganisationController::storeCreate` had a deliberate "skip check if no licence" branch, commented as *"so the initial setup flow isn't blocked"*. That comment turned the absence of a licence into the most permissive state — exactly backwards from what licences are for.
**Fix:** Removed the loophole. Replaced with three structured error codes the frontend can switch on:

| Condition | HTTP | `code` | When fired |
|---|---|---|---|
| No active licence on org | 422 | `LICENSE_REQUIRED` | OA tries to create any store, ever, before SA has issued one |
| Licence in soft- or hard-lock | 422 | `LICENSE_EXPIRED` | Returned with `valid_until` + `renewal_status` so the UI can format the message |
| Already at `max_stores` | 422 | `LICENSE_STORE_LIMIT_REACHED` | Includes `limit` + `current` for the banner |

Every payload carries a bilingual NL/EN message. Demo seeder (`DevelopmentDataSeeder`) now issues a `professional` licence (5 stores, 10 terminals, 1 year) for Supermarkt De Hoop so the demo flow doesn't trip the new gate.

UI side: Stores screen shows a licence banner (tier, status pill, valid_from→until, "N/M stores used", reference). **+ Nieuwe vestiging** button is `disabled` with a tooltip explaining which condition blocks them. If somehow the API still 422s, the modal surfaces specific guidance per code (email SA for missing/expired vs vendor for tier upgrade).

PHPUnit: `LicenseStoreCreationGateTest` covers all four cases (4 tests, 13 assertions).

**Lesson:** "Dev convenience" branches in business-logic code become production bugs. Build the proper gate from day one and fix the demo data path instead. If a fallback makes "missing config = unlimited access", flag it loudly during design — that's almost always inverted.

#### G-008 (2026-05-26) Multi-store pivot when product said 1:1
**Symptom:** User said "user cant be part of all stores. one user can be part of one store only" — overturning a pivot we'd just built.
**Cause:** Built what the previous instruction said (multi-store + "all stores" fallback) instead of validating the actual product rule first.
**Fix:** Strict 1:1 refactor — drop pivot, add `users.store_id`, no fallback.
**Lesson:** When the data model has an "all" / "any" / "empty = grants everything" rule, flag it explicitly to the user before building. That fallback is almost always wrong.

#### G-009 (2026-05-26) Carbon 3 `diffInDays` returns float
**Symptom:** "364.7965745746412 days left" in the licence UI.
**Fix:** `(int) floor(now()->startOfDay()->diffInDays($lic->valid_until, false))`.
**Lesson:** Any time we show a "days" number, cast to int. Don't trust the library to do it.

#### G-020 (2026-06-04) Stock decrement ran in an async job AFTER the sale committed
**Symptom:** Audit found that `SaleController::store` committed the sale, then dispatched `RecordStockMovements` onto the queue. If the queue was down or the job exhausted its 3 retries (then just `Log::error`'d), the sale was on record but stock was never decremented → real oversell. Worse: `StockMovementService::record` did `max(0.0, stock + delta)` which silently clamped oversells to zero, so the movement ledger became mathematically inconsistent (Σ qty_change ≠ qty_after) with no error raised.
**Fix:**
- Moved `recordSale()` INSIDE the sale `DB::transaction`. A queue outage can no longer desync sale and stock; a rejected oversell now rolls the whole sale back.
- Removed the `max(0.0, …)` clamp. `qty_after = stock + delta` (can go negative) so the ledger stays honest and a negative surfaces a wrong count.
- New per-org policy `organisations.block_oversell` (default **false** = allow + track negative; **true** = throw `InsufficientStockException` (422) and roll back). Toggle in Organisations → edit. Chosen over a hard DB CHECK because the default must allow negative; a CHECK would break it.
- Fixed the variant decrement: `->lockForUpdate()->decrement()` never actually locked (FOR UPDATE is ignored on an UPDATE; only honoured on SELECT). Replaced with `SELECT … FOR UPDATE` then explicit guarded `update()`, reusing the locked row for the cost snapshot.
**Tests:** `OversellPolicyTest` (3) + rewritten `SaleStoreTest::test_sale_decrements_per_store_stock` (asserts in-transaction decrement + ledger row, `Bus::assertNotDispatched` for the 'sale' reason — void/refund still async).
**Lesson:** Money/stock mutations belong in the same transaction as the thing that causes them. "Dispatch it async to keep the response fast" is a correctness trap for anything that must agree with the committed row. And `->lockForUpdate()->decrement()` is a no-op lock — always SELECT FOR UPDATE then UPDATE.

#### G-025 (2026-06-13) License lock returned 402 *after* the sale was already committed
**Symptom:** `EnsureLicenseValid` was supposed to block new sales under soft-lock, but a locked store could still complete sales.
**Cause:** the middleware did `$status = getStatus(); $response = $next($request); if (locked) return 402;` — it ran the controller FIRST (sale written, stock decremented, sale_number burned) and returned the 402 afterwards. The block was cosmetic; the side effect already happened. Same shape would let a hard-locked store mutate anything.
**Fix:** move the lock short-circuit *ahead* of `$next()`. The informational `X-License-Status` header (drives the dashboard banners) still rides on the passing response, but a blocking decision must be made before the request runs.
**Test:** `LicenseEnforcementTest::test_soft_lock_blocks_the_sale_before_it_is_created` asserts the 402 AND `assertDatabaseCount('sales', 0)`.
**Lesson:** a guard middleware that can DENY must decide before calling `$next`. "Compute status → run handler → maybe return error" is post-hoc and useless for anything with a side effect. Pair every deny-capable middleware test with an assertion that the side effect did **not** occur, not just that the status code is 402.

#### G-024 (2026-06-12) Audit verifier passed while 71% of the live log was unverifiable
**Symptom:** `audit:verify --all` reported every chain "intact" on the droplet, yet 87 of 122 live rows had a NULL `row_hash` and the De Hoop chain had actually broken at row 82. The tamper-evidence we sell to Rekenkamer was vacuous.
**Cause (three compounding):**
1. **Two writers, one hook.** Explicit `AuditLog::create()` rows get hash-chained in the model's `creating` hook; but **OwenIt model-audits** (Product/User/Customer `created`/`updated`) write to the *same* `audit_logs` table through OwenIt's own model — bypassing the hook — so they landed hash-less.
2. **Verifier skipped them.** Both `verifyChain()` and the `--all` commands used `whereNotNull('row_hash')`, so the unverifiable rows were silently excluded *and* the platform partition (`organisation_id IS NULL`) was never walked at all. A verifier that passes while part of the log is unchecked is worse than no verifier.
3. **Double-encode break.** Govt single-device, geo-alert, and `register.opened/closed` rows pre-`json_encode`d their payload into the `'array'`-cast `new_values` column → DB held a double-encoded JSON *string* → insert hashed the empty/dirty form, verify hashed the decoded form → those rows broke the chain.
**Fix:** (a) `Audited` listener → `AuditHashService::sealRow()` seals every OwenIt audit into its org chain on insert; (b) verifier now treats a NULL-hash row as a *break*, not a skip, and walks the NULL-org platform partition; (c) `getLastHash`/`verifyChain` are null-org-safe (`whereNull`, not `= NULL`) so the platform partition is one linked chain; (d) callers pass plain arrays and `canonicalJson()` un-nests legacy double-encoded rows; (e) `User::$auditExclude` drops password/2FA/passkey from audit values; (f) one-time live redaction of 5 rows that had leaked bcrypt/2FA secrets, then `audit:rebaseline --all --confirm` re-sealed all 122 rows → `audit:verify --all` green (PLATFORM 77 / De Hoop 15 / Josbin IT 31).
**Test:** `AuditChainCompletenessTest` (4) + `ComplianceIntegrityTest::test_register_lifecycle_audit_rows_keep_the_chain_valid`. NB: OwenIt skips auditing under `php artisan` unless `config(['audit.console' => true])` — the test sets it so the listener path is actually exercised.
**Lesson:** When two code paths write the same security-critical table, *both* must satisfy its invariant — don't assume one chokepoint covers writes that go around it. And a verifier must fail closed: anything it can't verify is a break, never a skip. (Sibling of G-023 — same chain, different blind spot.)

#### G-023 (2026-06-04) Audit hash chain never actually verified — create vs verify serialised differently
**Symptom:** Added the first end-to-end `verifyChain()` test after a login + BTW filing — it failed immediately ("Hash mismatch at row ID 4"). The SHA-256 audit chain, sold as Rekenkamer-grade tamper evidence, had **never been verified by a test** and did not actually verify.
**Cause:** `AuditLog::booted()` computed each row's hash from `created_at->toIso8601String()` (a Carbon in AST, e.g. `2026-06-04T10:00:00-03:00`), but `AuditHashService::verifyChain()` re-hashed using the **raw DB timestamp string** read back via `DB::table()` (format + offset depend on the session TZ). Same instant, different bytes → different hash. `new_values` had the same latent risk (array re-encode vs the cast's stored JSON, vulnerable to a future Laravel flag change).
**Fix:** Normalise inside `AuditHashService::computeHash` so BOTH callers agree regardless of representation:
- `created_at` → `Carbon::parse(...)->getTimestamp()` (Unix epoch second — no format/TZ ambiguity).
- `new_values` → decode-then-re-encode with fixed `JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE`.
**Test:** `ComplianceIntegrityTest::test_audit_chain_stays_valid_through_login_and_btw_submit`.
**Lesson:** A hash/signature/chain is only real if a test actually *verifies* it round-trip. Any value that is hashed at write time and re-hashed at read time MUST be reduced to a canonical, representation-independent form first — epoch seconds for time, decode→re-encode for JSON. "We compute a SHA-256" is not the same as "it verifies."

#### G-022 (2026-06-04) BTW reports relied on the Postgres container's TZ env, not app config
**Symptom:** Audit flagged `whereDate('occurred_at', …)` as classifying 21:00–23:59 AST sales into the next day (UTC session). On inspection the demo Postgres session was *already* `America/Paramaribo` — but only because `docker-compose.yml` sets `TZ=America/Paramaribo` on the container. A managed cloud Postgres (the documented SaaS path) ignores that and defaults to UTC, so BTW period boundaries would silently shift by 3h there.
**Fix:** Pinned `'timezone' => env('DB_TIMEZONE', 'America/Paramaribo')` in the `pgsql` connection config — makes the AST requirement explicit and infra-independent.
**Lesson:** A correctness property that holds "because the container happens to set an env var" is a latent bug for any other deployment. Encode timezone, locale, and currency assumptions in app config, not infra.

#### G-021 (2026-06-04) Time-bomb test: hardcoded month went red when the clock rolled
**Symptom:** `BtwSubmissionTest::test_inspector_dashboard_returns_platform_scope` started failing ("array is not empty") with zero code changes to that feature — purely because the system date rolled from May into June 2026. The test filed a `2026-05-20` submission but `inspector-dashboard`'s `top_orgs_month` windows to `startOfMonth()→now` (June), so the May row fell outside the window.
**Fix:** Anchor the test's sale + submission to `Carbon::now('America/Paramaribo')->startOfMonth()` instead of a hardcoded date.
**Lesson:** Any test that asserts on a "this month / today / last N days" aggregation must build its fixtures relative to `now()`, never a hardcoded calendar date. Hardcoded dates in time-windowed tests are latent failures that detonate on a future run with no warning.

### UI / cross-surface

#### G-010 (2026-05-26) Feature added to one screen, missing from every other
**Symptom:** Multi-store assignment column added to Users list, but missing from /auth/me payload, MyAccount header, edit-modal pre-fill.
**Cause:** Built one screen at a time without walking the surfaces checklist.
**Fix:** Use §2 of this doc.
**Lesson:** This is the most expensive bug pattern we have. Read §2 every time.

#### G-011 (2026-05-26) Doc cross-refs to non-existent chapters
**Symptom:** `dashboard_manual/11-z-reports-and-end-of-day-sync.md` linked to `08-registers.md` three times. That chapter was never written.
**Fix:** Updated refs to point at the closest real chapter (`user_manual/03-register.md`) and added task #67 to write the real chapter.
**Lesson:** Before adding a cross-ref, check the target file exists. If you intend to write it, add a `[chapter] (coming soon)` marker so it's findable later.

#### G-012 (2026-05-26) "Also surface this in N other screens" — the cross-surface display lens
**Symptom:** User asked *"also add licence type, start and expiry on user list on SA dashboard"* immediately after we wired the licence gate on the Stores screen.
**Cause:** When a new fact enters the system (e.g. "this org has a licence"), it deserves to be visible everywhere a human asks a related question. We had only shown it on the Stores screen (the OA's view) and forgotten that the SA, looking at the Users list, also wants to know at a glance which org has which licence.
**Fix:** Added `org_license` to the `/api/users` response (single grouped query — no N+1), added a SA-only **Licentie / Licence** column to the Users table with tier + colour-coded status pill + valid_from→until.
**Lesson:** When you add a piece of data, walk the screens that *answer related questions* and ask "would this user expect to see the new fact here too?" Concrete prompts to ask yourself:
  - The list view that shows entities of this type
  - The detail view that shows *one* such entity
  - The dashboard / overview that summarises across entities
  - The audit log entry that records the change

Almost every "you missed a place" bug we've hit traces back to skipping this step. Add it to §2 (surfaces checklist) when you skim it.

#### G-013 (2026-05-26) Duplicated type definitions across screens
**Symptom:** `License` interface defined inline in `LicenseScreen.tsx`. When `StoresScreen.tsx` needed the same shape, copy-pasting would have created two definitions that drift over time.
**Cause:** Initial development pattern: define types where you first use them. Fine for one-off types; bad when a second consumer appears.
**Fix:** Extracted to `dashboard/src/api/licenses.ts` (the file that already housed the API client). Both screens import from there now.
**Lesson:** As soon as a second screen needs the same backend response shape, the type belongs in `api/*.ts`, not co-located in the first screen. The trigger to extract is "the second consumer", not "the third" — by the third you've already paid for the drift.

#### G-014 (2026-05-26) "Contact support" with no actual support address
**Symptom:** User flagged the licence-missing banner copy: *"The Super Admin must issue one before you can create stores or onboard new users. Send a request with your organisation name to support. this you think practical ? mention Josbin our org name"*.
**Cause:** Three separate problems compounded:
  1. The copy referenced "Super Admin" — an internal role the OA doesn't know about. From the OA's perspective they need to email *Josbin*, not "a Super Admin somewhere".
  2. "Send a request to support" had no email address, no phone, no next step. The OA has to figure out who *support* is.
  3. The same vague pattern was duplicated in 4 places (banner, button tooltip, modal error × 3 codes, read-only header footer, plus two doc files) — so it would drift on the next reword.
**Fix:**
  - Added `config('josbin_pos.vendor')` in `backend/config/josbin_pos.php` with `name / email / phone / website`, overridable per-deployment via `JOSBIN_POS_VENDOR_*` env vars (so resellers can rebrand).
  - Exposed via `/api/environment` (public, no auth) and `/api/auth/me` payload so any screen — even login — can read it.
  - Created `dashboard/src/hooks/useVendor.ts` with module-level cache + sensible default so first paint never shows `undefined`.
  - Rewrote every "contact support" surface in `StoresScreen.tsx` to name **Josbin** explicitly, include a clickable `mailto:` with subject + body pre-filled (org name auto-inserted), and a `tel:` link. The OA's flow is now: see banner → click "Send email" → email client opens with everything filled in → press Send.
  - Updated two `dashboard_manual` files with the real email instead of "contact support".
**Lesson:**
  - **Never use "contact support" alone.** That phrase is a TODO marker. Always pair it with a concrete contact method.
  - **Never reference internal roles in client-facing copy.** "Super Admin" means nothing to a Surinamese supermarket OA. From their seat, the chain of authority looks like: *me → Josbin*. Period.
  - **When the same wording appears in ≥ 2 places, push the data to config/env immediately.** This is the cross-surface lens from G-012 applied to *copy*, not just to *fields*. Today's banner had four duplicates; tomorrow's similar feature will have eight if we don't fix the pattern.

#### G-015 (2026-05-26) Showed cashier-only tabs to org-scoped roles
**Symptom:** User logged in as Super Admin, opened My Account, and saw a "My shifts" tab. *"do you think its practical, you are AI, why not use intelligence then?"*
**Cause:** `MyAccountScreen.tsx` had a single hardcoded tab list for everyone: `[performance, shifts, profile]`. The Performance tab queries `/me/sales-summary` (sales the user rang up); Shifts queries `/me/shifts` (register sessions the user opened). Neither has any meaning for SA, OA, Auditor, or API Integration — those roles never ring up a sale or open a register. The page would render empty cards forever for them.
**Fix:** Built the tab list per role *before* the `useState` so the initial tab is one this role can see. `RINGS_UP_ROLES = ['cashier', 'store_manager']` is the only set that gets the full three tabs; everyone else sees Profile only. Added a defensive guard in the render body too (defence in depth) and a comment pointing at future tabs that *would* make sense for org-scoped roles (activity log, API tokens).
**Lesson:**
  - **Build for the actual user, not the abstract user.** "User" doesn't open the dashboard — a *specific role* does. Every screen with role-divergent meaning needs role-gating, not a one-size-fits-all layout.
  - **Empty-state tabs are worse than missing tabs.** A blank Shifts page for SA suggests *we forgot to load data*. A missing Shifts tab tells them *this isn't for me* — honest.
  - **Compute role-gated UI structure before state init.** Defaulting to `tab='performance'` and *then* hiding the tab leaves the screen broken until the user clicks something. Initial state should always pick from the visible set.
  - **The §3 onboarding journey already documents what each role does.** When building a screen, read it first. If "Super Admin" doesn't appear under the feature in §3, the feature doesn't belong in their UI.

#### G-016 (2026-05-26) Flat 20-item nav with no role hierarchy
**Symptom:** User asked: *"also check our super admin, the menus, keep things which a Super admin should see and worry. proper industry standards"*. Looking at the Super Admin's nav: 20+ items in one flat list, mixing platform governance (Organisations, Licenses, Audit Log, Users) with tenant operational tools (Stock, Discount Rules, Customers, Z-Reports, Receipt templates, POS launcher). No visual hierarchy — Licenses sat between Audit Log and an unused POS launcher button.
**Cause:** The original nav was a flat array filtered by `roles: string[]` per item. Worked when there were 8 items; falls apart at 20. There was no concept of "this role's *primary* concern" vs "this role *can* access this but shouldn't browse it daily". Same item rendered identically for SA (platform admin) and OA (catalogue owner) — but their relationship to e.g. Z-Reports is completely different (SA: support tool; OA: daily ops).
**Fix:** Replaced flat `roles[]` array with per-role `sections` map + `SECTION_ORDER` per role + a section-grouped renderer:

```
SUPER ADMIN sidebar (industry standard — Stripe / Shopify Plus / Datadog):
  ─ PLATFORM ─
    Dashboard, Organisations, Licenses, Users, Audit Log,
    AI Insights, API Keys
  ─ SUPPORT — TENANT DATA ─
    Stores, Reports, Z-Reports, Comparison, Catalogue, Import/Export,
    Price Overrides, Discount Rules, Stock, Registers, Customers, Store Settings
  ─ ACCOUNT ─
    My Account

ORG ADMIN:    Operations / Catalogue / Organisation / Account
STORE MGR:    Operations / Catalogue / Organisation / Account
AUDITOR:      Operations / Compliance / Account
```

Same screen lives under different sections per role (e.g. "Users" is in *Platform* for SA but *Organisation* for OA — same code, different framing). POS launcher removed from SA + Auditor's nav (they never ring up; was a footgun).
**Lesson:**
  - **A flat role-filtered nav scales until ~8 items, then breaks.** Past that you need *sections + per-role section order*, not more filters.
  - **The same screen can mean different things to different roles.** Frame it for the role: SA browses Z-Reports for support, OA lives in them daily. Don't pretend the experience is identical just because the page is.
  - **"Support tools" / "Tenant data" sections are an industry-standard SaaS admin pattern.** Stripe, Shopify Plus, Datadog org-admin, Auth0 all group platform-governance items separately from tenant data the admin *can* access but shouldn't browse for fun. Customer data deserves friction — visual separation is a soft form of that friction.
  - **Role-aware UI is composable from two primitives**: (a) which sections does this role have, in what order? (b) which section does each item sit in, per role? Once you have both, the renderer is mechanical — no special-casing per role in JSX.

#### G-017 (2026-05-26) Spatie permissions baked into Sanctum token abilities → stale on every reseed
**Symptom:** User logged in as Store Manager, tried to create a category, got *"This action is unauthorized."* Backend verification: SM has the `categories.manage` permission, the policy gate is correct, a freshly issued token can create the category (HTTP 201). The actual user's browser token (issued earlier in the session) was rejected.
**Cause:** `AuthController::login` snapshots `$user->getAllPermissions()` into the Sanctum token's `abilities` column at issue time. Once written, that array never updates — change a permission, reseed the DB, edit a role, and every existing token is stale until it expires (12h) or the user logs out + back in. We hit this three times in one day (G-001 dashboard pointed at empty backend, G-002 demo DB wiped under us, G-017 this). The pattern is structurally fragile: it mixes *user-permission state* with *token-state* in a single field that's written once.
**Immediate fix (for the user in front of you):** log out + hard refresh + log back in. Clears localStorage, gets a fresh token reflecting current permissions.
**Systemic fix (tracked as task #74):** issue session tokens with `['*']` ability so they never go stale on permission changes; keep `'2fa_verified'` as a separate explicit ability flag in the abilities array; change `EnsureTwoFactor` middleware to check `in_array('2fa_verified', $token->abilities, true)` directly instead of via `tokenCan()` (which would return true under `'*'`). Authorization keeps working because policy/spatie gates re-read user permissions at every request — always fresh. ~30 lines net, touches `AuthController` (4 token-issue sites) + `EnsureTwoFactor` middleware + 2FA tests.
**Lesson:**
  - **Never snapshot mutable state into immutable token fields.** Tokens are stable identifiers, not permission caches. Permissions are policy/gate concerns and belong at the request layer.
  - **When the same class of bug bites 3 times in a day, the diagnosis is wrong — fix the structure, not the instances.** Each instance got a tactical patch (reseed, point dashboard at right port, ask user to re-login). The structural fix (don't bake permissions into tokens) would have prevented all three.
  - **Token abilities vs spatie permissions are different concerns.** Token abilities = "what this *token* is allowed to do" (e.g. pre-auth 2FA challenge tokens have ONE ability and rightfully so). Spatie permissions = "what this *user* is allowed to do" (subject to change as roles evolve). Conflating them turns every permission change into a token-invalidation event.

#### G-018 (2026-05-26) When does "new role" beat "new portal"?
**Symptom:** User asked: *"create portal for a government /tax dept, or what do you think we can create a gov / tax department user, which is better you can suggest"*. Two valid-seeming options: build a second app (Gov Portal) or add a new role inside the existing dashboard.
**Decision:** New role. Reasoning logged here so future requests for "should we build a separate X-portal" have a tested answer.
**Criteria for choosing a separate portal (NONE of which applied to Belastingdienst here):**
  1. **Different identity domain** — users come from a different IdP / SSO / federation tree, can't be mapped into the main user table without contortion.
  2. **Different theming / accessibility / regulatory contract** — gov portals sometimes require WCAG AAA, branding lockup, language defaults that genuinely diverge.
  3. **Different deployment / network isolation** — e.g. gov-cloud-only, separate database, separate audit trail by legal mandate.
  4. **Wildly different feature surface** — if the new audience shares <20% of the existing surface, the cost of role-gating exceeds the cost of forking the app.
**Criteria for adding a new role to the existing app (what we did):**
  1. Users live in the same `users` table, authenticate the same way.
  2. They consume the same data (BTW submissions are produced by existing taxpayers — same DB).
  3. Visual / brand requirements are the same.
  4. The new feature surface is small enough to fit cleanly under one section in the existing nav.
  5. Cost of building & maintaining a second app dwarfs the cost of role-gating in the first.
**What we shipped:** `tax_inspector` (7th role). Cross-org read-only access via `isCrossOrgRole()`, 2FA mandatory (added to `TWO_FACTOR_ALWAYS_ROLES`), default landing screen is BTW Submissions, sees only Compliance + Account sections. Zero changes to the dashboard scaffolding — the G-016 sectioned-nav architecture absorbed the new role mechanically (one entry in `SECTION_ORDER`, one `sections: { [TI]: 'compliance' }` map on each relevant nav item).
**Lesson:**
  - **A separate portal is a structural commitment.** Once shipped, it's a second build pipeline, second deploy target, second auth surface, second drift vector. Worth it only when the criteria above are met. Default to "new role" unless they clearly fail.
  - **Role architecture pays compound interest.** G-016 (sectioned nav) made adding a 7th role take ~3 lines of nav config + one section-order entry. Designing for "any number of future roles" early is cheaper than every retrofit.
  - **The hash-chain pattern from `audit_logs` generalises.** When we needed tamper-evidence for BTW submissions, we copied the SHA-256 chain pattern directly. Build one such pattern well, reuse it everywhere that needs the same property.

#### G-019 (2026-05-26→27) Eliminated stale-token bug class with wildcard ability tokens (task #74)
**Symptom (predicted by G-017):** every permission / role / seeder change forced existing users to log out + back in to pick up the change. Hit 3+ times in two days.
**Cause (recap):** `AuthController` snapshotted `$user->getAllPermissions()` into the Sanctum token's `abilities` column at issue time. Once written, that array never updated.
**Fix:** session tokens now carry the `['*']` wildcard ability (plus literal `'2fa_verified'` after 2FA confirm). Permission checks happen at *request* time via policies + spatie/permission gates, which always reflect the user's current state. Pre-auth tokens (2FA setup, 2FA challenge) keep their narrow abilities. `EnsureTwoFactor` middleware switched from `tokenCan('2fa_verified')` (which would always be true under the wildcard) to a literal-string `in_array('2fa_verified', $abilities, true)` check. Same literal-check pattern for the `twoFactorSetup` endpoint.
**Verified by:**
  - New `WildcardTokenTest` (3 tests): login issues `['*']` token; permission change propagates without re-login; pre-auth 2FA tokens stay narrow `['two_factor_setup']`.
  - Full PHPUnit suite (137 tests) still passes — including all 2FA-related tests and the EnsureTwoFactor-gated routes. The refactor was non-breaking.
**Lesson (now structurally enforced):**
  - **Permission state and identity state belong in different places.** Identity = token (immutable for the session's lifetime). Permission = a fresh DB read at every request. Conflating them is the bug.
  - **Wildcards on session tokens are safe IF AND ONLY IF token-level flags (like `'2fa_verified'`) are checked via literal-match, not via `tokenCan()`.** Document this requirement clearly so a future developer doesn't "simplify" the EnsureTwoFactor check back to `tokenCan` and silently disable 2FA for the whole platform.
  - **When the same class of bug appears 3+ times, the structural fix pays for itself in the next 3 weeks.** Today's ~50-line change makes every future permission tweak (new role, new spatie perm, role-edit by SA) propagate instantly. Zero re-login friction for users; zero "log out + back in" stale-token tickets for us.

---

## §5 Project-specific conventions

### Money
- **Always** `DECIMAL(12,2)` SRD in Postgres. Never float.
- Backend arithmetic uses **BCMath** (`bcadd`, `bcsub`, `bcmul`).
- Frontend can use number arithmetic for **display only** — never derive a value sent back to the API from a JS multiplication.

### BTW (VAT)
- Currently 10% in Suriname. Configurable per product. Exempt flag for basic foods + medicine.
- **Discount-then-tax order** is the law. Apply all discounts first, then extract BTW from the post-discount total.
- BTW extraction: `btw = price - price / (1 + rate)` (tax-inclusive pricing).
- BTW reports format must match Belastingdienst Suriname expectations.

### Timezone
- All `timestamptz` columns store UTC, but the app **always renders AST** (America/Paramaribo, UTC-3).
- Use Laravel's timezone config + `Carbon::now('America/Paramaribo')` for "today" calculations.

### UUIDs
- All PKs are UUIDv4 (`gen_random_uuid()`). No bigint IDs anywhere.
- Spatie permission tables required a manual migration to use uuid for `model_uuid` — see migration `2026_04_12_200014_fix_permission_tables_for_uuid`.

### Idempotency
- Sales pushed via external API carry `external_sale_ref` — UNIQUE per `(api_integration_id, external_sale_ref)`. Duplicate refs are silently ignored.
- Webhooks use HMAC signatures (`X-JosbinPOS-Signature: sha256=<hmac>`).

### Audit log
- Append-only. Never `UPDATE` or `DELETE` an `audit_logs` row.
- Events follow `category.action` naming: `auth.login_success`, `user.store_assigned`, `z_report.closed`, `sale.refunded`.
- `old_values` / `new_values` are JSONB diffs. `null` is allowed.
- Use the `AuditLog::create()` model OR `\DB::table('audit_logs')->insert()` — both work, both append.

### Authorisation
- Policy classes in `app/Policies/`. Each model gets one.
- Role checks via spatie/permission. **Never** trust frontend role checks — they're for UX only; the policy is the gate.
- "Org-scoped" roles: super_admin, organisation_admin, auditor, api_integration. They ignore `store_id`.
- "Store-scoped" roles: store_manager, cashier. They must have `store_id` set.

### File naming
- Backend: PascalCase for classes, snake_case for migrations + DB columns.
- Frontend: PascalCase for components + types, camelCase for hooks + utils + variables.
- Doc chapters: `NN-kebab-case-title.md`, two-digit prefix preserved across both manuals.

---

## §6 Operational practices

### Bringing the stack up
```bash
bash scripts/dev.sh up              # demo by default
JOSBIN_STACK=live bash scripts/dev.sh up
JOSBIN_STACK=sandbox bash scripts/dev.sh up
bash scripts/dev.sh status          # what's running, where
bash scripts/dev.sh down            # stop dev servers (Vite, docs)
```

Each stack has its own ports + DB:
| Stack    | Backend | Reverb | POS  | Dashboard | Docs  | DB              |
|----------|---------|--------|------|-----------|-------|-----------------|
| live     | 8080    | 6001   | 5173 | 5174      | 5180  | josbin_pos      |
| demo     | 8082    | 6002   | 5173 | 5174      | 5180  | josbin_pos_demo |
| sandbox  | 8091    | —      | —    | —         | —     | josbin_pos_sandbox |

POS + dashboard dev servers serve **whichever stack is up**; the env var routes them.

### Before declaring "done"
```bash
# 1. Backend tests
docker exec josbin_demo_app php artisan test

# 2. POS typecheck + unit tests
cd frontend && npm run type-check && npm run test:run

# 3. Dashboard typecheck + unit tests
cd dashboard && npm run type-check && npm run test:run

# 4. Smoke test
bash scripts/smoke-test-demo.sh
```

If you don't have time to run all four, run the one most likely to break given your change:
- Backend code → tests
- Type changes → tsc
- New route → smoke

### Seeding & reset
```bash
# Re-seed without dropping data (idempotent)
docker exec josbin_demo_app php artisan db:seed --force

# Full reset of demo (loses ALL data — only when you mean it)
docker compose -p josbin_demo down -v
bash scripts/dev.sh up
docker exec josbin_demo_app php artisan migrate --force
docker exec josbin_demo_app php artisan db:seed --force
```

### Health check (mental version until `dev.sh doctor` exists)
```bash
# Is the backend reachable?
curl -s http://localhost:8082/api/health

# Is the demo DB populated?
docker exec josbin_demo_postgres psql -U josbin_pos -d josbin_pos_demo \
  -tAc "SELECT count(*) FROM users;"   # expect 4

# Is the dashboard proxying to the right backend?
ps aux | grep "vite --port 5174" | grep -v grep    # check VITE_API_URL in env (cannot — needs lsof or restart)
```

---

## §7 Doc map — where lives what

```
README.md                         # Quick start, stack overview, login table, test commands
CLAUDE.md                         # Product spec — auto-loaded into every session
CLAUDE_WORKING_GUIDE.md  ← this file # Engineering discipline + gotchas
HANDOVER.md                       # Continuity map: live infra, access/secrets locations, status snapshot
docs/                             # Dev docs (architecture HTML, install guide, BTW spec)
dashboard_manual/                 # HQ/manager/SA user manual (18 chapters)
user_manual/                      # POS cashier/manager-at-store manual (~13 chapters)
docs-site/                        # VitePress site rendering both manuals at :5180
backend/tests/                    # PHPUnit (Feature + Unit)
frontend/src/**/*.test.ts         # Vitest POS unit tests
dashboard/src/**/*.test.ts        # Vitest dashboard unit tests
scripts/
  ├── dev.sh                      # Boot stack + dev servers
  ├── smoke-test-demo.sh          # HTTP probes against demo
  └── encode-ioncube.sh           # Build-time PHP encoding
```

When in doubt where to write something, ask: "Who is the audience?"
- Future-me at 2am? → CLAUDE_WORKING_GUIDE.md (this file)
- A new dev cloning the repo? → README.md
- The client's manager training on the dashboard? → dashboard_manual/
- The client's cashier? → user_manual/

---

## §8 Suriname glossary

| Term | Meaning |
|---|---|
| **BTW** | Belasting over de Toegevoegde Waarde — Suriname VAT (currently 10%) |
| **Belastingdienst** | Suriname Tax Authority — BTW filings go here |
| **Rekenkamer** | Suriname Court of Audit — government financial accountability |
| **WBP-S** | Wet Bescherming Persoonsgegevens Suriname — personal data protection law |
| **Verwerkersovereenkomst** | Data Processing Agreement (required for government clients) |
| **AST** | Atlantic Standard Time — America/Paramaribo, UTC-3 |
| **SRD** | Surinaamse Dollar — the currency, freely floating since June 2021 |
| **Belastingnummer** | BTW registration number on receipts |
| **Z-Report** | End-of-day register close — formal audit boundary |
| **X-Report** | Mid-day snapshot — no register close |
| **Sranantongo** | Surinamese creole — future i18n target (Phase 5+) |

---

## §9 Open questions / future decisions

Things we don't have a clean answer for yet. When one gets resolved, move it to the relevant convention in §5.

- **Stock alerts threshold** — per-product or per-category default? Currently per-product `low_stock_threshold` only.
- **Sale void vs refund** — when does an action become a "refund" (separate row) vs a "void" (status flip)?  Currently: refund always creates a new row, void flips status, both leave the original intact.
- **POS auto-restart cadence** — Settings → System has a Restart button (manager-gated). Do we auto-restart nightly at 03:00 AST?
- **Sranantongo i18n** — Phase 5+ goal but no commitments on coverage scope.

---

## §9a What's verified, and what's hand-test-only

A recurring honesty question: "have you verified hardware X works?" The unambiguous matrix:

| Layer | Automated verification | Manual hand-test needed |
|---|---|---|
| ESC/POS byte composition (`escpos.ts`) | ✅ Vitest — pin-2 / pin-5 / paperCut all asserted byte-exact | — |
| Cash drawer pulse routing per platform (`hardware.ts`) | ✅ Code-correct (Electron IPC vs Capacitor plugin vs no-op fallback) | ✅ Plug real Verifone/Epson terminal in, press Test cash drawer in Settings → Printer |
| Network TCP print to port 9100 | ✅ Code path exists | ✅ Print test receipt against actual printer IP |
| USB print on Windows (Electron + Windows spooler) | ✅ Code path exists | ✅ Install printer driver, ring a test sale |
| USB print on Android (`@capgo/capacitor-printer`) | ✅ Plugin in deps + bridge in `capacitor-printer.ts` | ✅ Build APK (`npm run build:android`), install on device, ring a test sale |
| Android APK build itself | ✅ Capacitor config present, scripts wired | ✅ Run `npx cap sync && npx cap open android`, sign + install |
| ExchangeRate-API → SRD rate fetch | ✅ Code path + retry | ✅ Run `php artisan rates:lock` on a real day, verify the rate landed |
| WBP-S customer field encryption | ✅ Unit-tested encrypt/decrypt round-trip | — |
| Belastingdienst BTW PDF format | ✅ DomPDF render path tested | ✅ Open the generated PDF in Acrobat, verify it matches Belastingdienst's expected layout |
| License hardware-fingerprint binding | 🟡 Code stubs only (G-005 / G-006 in FEATURES_AND_FLOWS) | — |
| 5-layer offline sync (layer 1/2/3/5) | ✅ E2E test in task #43 | — |
| 5-layer offline sync (layer 4 — USB encrypted export) | ✅ Code path + tests | ✅ Save .josbin_pos file to a USB stick, plug into HQ machine, upload via dashboard |

**Rule of thumb when I'm asked "did you verify X?"**: if X is byte-level code or DB-level logic, the unit/feature test suite covers it. If X requires a physical port, a card terminal, an Android device, or a printer that emits paper, the answer is *"verified the code path, the unit test of the byte composition is green, but the physical hand-test happens during the first-customer install or via the Test buttons in the POS Settings screen — I do not have hardware in the dev environment."*

This isn't a gap in the project — it's the boundary of what's testable from a CI environment. Real hardware verification belongs on the install checklist + the trainer cheat sheet, both of which exist. What's worth fixing is making this matrix easy to find — that's why it lives here.

---

## §10 Changelog — every entry in this doc, dated

Append at the bottom. Never edit history.

- **2026-05-26** — Document created. Initial structure: mental model, surfaces checklist, end-to-end journeys, gotcha registry (G-001 through G-011 from today's session), conventions, ops practices, doc map, glossary, open questions. Triggered by user feedback: *"so many gaps!"* — agreed, this doc is the response.
- **2026-05-26** — Expanded G-007 with the full licence-gate design (three structured error codes, demo seeder fix, frontend banner + button gating, PHPUnit suite). Added G-012 (cross-surface display lens — when a new fact enters, walk list / detail / overview / audit views) and G-013 (extract shared types to `api/*.ts` on the *second* consumer, not the third). Added a new "cross-surface display lens" section to §2 listing the four related views to walk. Triggered by user asking *"add licence type, start and expiry on user list on SA dashboard"* right after we'd already shipped the gate on the Stores screen — a textbook case of the lens we just named.
- **2026-05-26** — Added G-014 (never "contact support" without a concrete email/phone, never reference internal roles in client-facing copy, push duplicated wording to config the moment it appears in ≥ 2 places). Triggered by user calling out the no-licence banner copy as impractical. Fix shipped: `config('josbin_pos.vendor')` + `useVendor` hook + mailto with pre-filled subject/body across all four `StoresScreen.tsx` surfaces + two `dashboard_manual` files.
- **2026-05-26** — Added G-015 (role-gate UI structure per actual user — build for cashier-or-not, SA-or-not, etc., don't show empty tabs for roles that can never populate them; compute the gated layout before `useState` init so the default tab is always visible). Triggered by user spotting "My shifts" tab on Super Admin's My Account: *"do you think its practical, you are AI, why not use intelligence then?"*. Fix shipped: `RINGS_UP_ROLES` constant + per-role tab list in `MyAccountScreen.tsx`, SA/OA/Auditor/API now see Profile only.
- **2026-05-26** — Added G-016 (flat 20-item nav doesn't scale — past ~8 items role-aware UI needs sections + per-role section order; same screen can mean different things to different roles and the framing should reflect that; "Support tools" / "Tenant data" sections are an industry-standard SaaS admin pattern). Triggered by user: *"also check our super admin, the menus, keep things which a Super admin should see and worry. proper industry standards"*. Fix shipped: `SECTION_ORDER` + `sections` map + grouped renderer in `DashboardLayout.tsx`. SA now sees `PLATFORM` (7 items they own) + `SUPPORT — TENANT DATA` (12 items they can reach for support but shouldn't browse) + `ACCOUNT`. OA / SM / Auditor see appropriate role-specific sections. POS launcher removed from SA + Auditor nav.
- **2026-05-26** — Added G-017 (spatie permissions baked into Sanctum token abilities at login time → stale until next login on every permission/role/seed change). User triggered: tried to create category as Store Manager, got 403 "This action is unauthorized" despite the SM role having `categories.manage`. Diagnosis: fresh tokens work; user's browser had a stale token from an earlier session. Tactical fix: re-login. Structural fix tracked as task #74 — issue session tokens with `['*']` ability and let policy/spatie gates handle authz at request time. Meta-lesson: when the same class of bug bites 3× in a day (G-001 wrong backend, G-002 wiped DB, G-017 stale perms in token), fix the structure, not the instances.
- **2026-05-26** — Added G-018 (when to add a new role vs build a separate portal — concrete criteria for each, not vibes). Triggered by user asking *"create portal for a government /tax dept, or what do you think we can create a gov / tax department user, which is better you can suggest"*. Decision documented: new role beat separate portal because users share identity domain, data, theming, and 80%+ of feature surface. Shipped `tax_inspector` role end-to-end (migration, model, service, policy, controller, 10 PHPUnit tests, screen, modals, nav entry, demo user, role badge, default landing screen). Companion meta-lesson: the G-016 sectioned-nav architecture absorbed the 7th role with ~3 lines of nav config — designing the framework well early pays compound interest on every future role addition.
- **2026-05-26** — Added G-019 (eliminated stale-token bug class with wildcard `['*']` ability tokens — task #74 shipped). 50-line refactor of `AuthController` + `EnsureTwoFactor` middleware switched from `tokenCan` to literal `in_array('2fa_verified', $abilities, true)` check. 3 new PHPUnit tests prove: login issues `['*']`; permission change propagates without re-login (the bug); pre-auth tokens stay narrow. Full suite 137 passing.
- **2026-05-27** — Added §9a "What's verified, and what's hand-test-only" — a permanent matrix mapping each layer (ESC/POS bytes, cash drawer pulse routing, USB print, network TCP print, Android APK, ExchangeRate-API fetch, BTW PDF format, 5-layer sync, license fingerprint) to "automated verification" vs "physical hand-test on first install". Triggered by user asking *"cash drawer, android terminal and those main stuff you verified correct all working fine?"* — honest answer is the byte-level code is unit-tested + the platform routing is correct, but physical hardware verification belongs on the install checklist + cashier's Test buttons. Permanent reference now lives in the doc instead of being re-derived each session.
- **2026-05-27** — Closed the BTW Submissions + tax_inspector doc gap (the user spotted: workflow shipped + tested + in FEATURES catalogue but no dashboard manual chapter). Added `dashboard_manual/20-btw-submissions-belastingdienst.md` (full OA/SM/Inspector workflow + supersede flow + audit log mapping + 5 common-situation Q&A) and `dashboard_manual/21-tax-inspector.md` (the role explained for SA creating accounts, the Inspector themselves, and curious OAs). Updated `user_manual/11-reports.md` BTW callout to point at the new chapter 20. Both chapters cross-reference G-018 (the "role not portal" decision) for design rationale.
- **2026-06-12** — Added G-024 (audit verifier passed while 71% of the live log was unverifiable). Batch A of the post-review fix sweep: OwenIt model-audits now seal into the hash chain via an `Audited` listener; the verifier fails closed on any NULL-hash row and walks the platform (null-org) partition; double-encoded `register.*`/govt/geo rows fixed; `User::$auditExclude` strips secrets; live secrets redacted + chain rebaselined green. Also SEC-1 (`throttleApi('api')` — the 240/min limiter was dead config) and SEC-2 (price-override IDOR — `{store}` was UUID-bound with no org scope). Full suite 219 passing.
- **2026-06-13** — Post-review fix sweep Batches B–E shipped + deployed. **B (correctness):** CR-1 variant double-decrement — variant lines deducted both the variant row AND the parent `product_stocks`; `recordSale`/`recordVoidOrRefund` now route variant lines to the variant row only, refund carries `variant_id` forward (+SalesVariantFlowTest). **C (performance):** PERF-1 — all report/dashboard date filters moved off non-indexable `whereDate(occurred_at,…)` to indexable, session-TZ-independent half-open ranges via new `App\Support\AstDates` (+ReportDateBoundaryTest pins AST-day bucketing across a UTC-straddling midnight); PERF-2 `/products/pos` eager-loads constrained to the requested store; PERF-10 batch-load in void/refund. **D (UX + 2 bugs):** receipt-email never sent (frontend omitted the required `email` field → always 422) — fixed + validated; card "Skip & complete" was a no-op duplicate of "Complete with details" (both called `handleComplete('card')`) — added `skipRecon`; new shared POS `ConfirmDialog` guards clear-cart, held-bill-restore-over-non-empty-cart, and logout/switch-store-with-items; direct per-line delete; F2/F9 shortcut hints. **E (features):** G-025 license-lock-before-`$next` fix; manual cash in/out (pay-in/pay-out) feature folding into Z-Report expected cash (`cash_movements` table + CashMovementModal); **returns without original sale** (blind return — `SaleController::blindReturn`, manager-gated, BTW-extracted, stock-restored, `sale.blind_return` audit event, +BlindReturnTest); **weighed-goods / scale embedded-barcode parsing** (`lib/embeddedBarcode.ts` configurable parser + 7 vitest, wired into the POS scan handler, Settings → Weighed goods — layout must be confirmed vs the client's actual scale before go-live). Backend 234 passing; frontend 37 vitest. **Still deferred (its own focused build):** loyalty points. **Deferred scale-only perf:** PERF-6 (sale_number sequence), PERF-7 (DISTINCT ON latest Z-report), PERF-9 (is_low generated column).
- **2026-06-20** — Shipped the **in-app notification bell** for the BTW dispute/accept/resubmit loop (the workflow was pull-only — taxpayers only learned of a dispute by re-checking the list). Laravel database notifications: `BtwFilingDisputed`/`Accepted`/`Resubmitted`, all `ShouldQueue` with `via=[database,mail]` so a mail/SMTP failure is isolated to its own job and can never block the inspector's web action nor suppress the in-app row for other recipients. `NotificationController` (index/read/read-all) strictly scoped to `$request->user()` via the Notifiable relation; `NotificationBell.tsx` polls 60s, badge + dropdown + mark-(all-)read + click-through. Also: weekly period type, and an org-filter bugfix (it was empty for the inspector — `/organisations` excluded `tax_inspector` AND the inspector's `organisation_id` is null, so the own-org branch returned nothing; fixed via `isCrossOrgRole` + `?all=true`). Fixed a stale comment in `supersede()` that wrongly claimed a 500 on the 2nd resubmit — the partial unique `btw_subs_active_period_unique WHERE status <> 'superseded'` already permits unlimited resubmission. +`BtwNotificationTest` (4); full suite 241 passing. **G-026 (deploy gotcha):** Horizon runs in its **own `horizon` container**, not in `app`. `docker compose exec app php artisan horizon:terminate` prints "No processes to terminate" and does nothing — the worker keeps running stale code, so newly-added queued job/notification classes are never picked up. Restart the actual worker: `docker compose ... restart horizon` (or `exec -T horizon php artisan horizon:terminate`). Any deploy that adds/changes a queued class must bounce the `horizon` container. **Note:** queued notifications need real SMTP creds in the droplet `.env` for the *email* channel to deliver; the *in-app* (database) channel works regardless.
- **2026-06-20** — **Store-scoped the Store Manager BTW filing** (audit prompted by "check store manager side, is BTW submit full-fledged?"). It worked, but was org-wide: an SM — locked to one store in Reports/Stock/Z-Report — could file/see the whole org's consolidated BTW return (and saw other stores' sales in the preview). Now `User::isStoreBound()` (cashier/SM) drives: `validatePayload` **forces** `store_id = user.store_id` for SM (ignores client input; 422 if unassigned), `index` + `inspectorDashboard` scope to the SM's store, and `BtwSubmissionPolicy::view`/`supersede` reject other stores. OA still files org-wide (store_id null) = the formal Belastingdienst return. The partial unique index became store-aware via `COALESCE(store_id, '000…0'::uuid)` so org-wide + per-store filings for one period coexist while same-store-same-period is still blocked (a plain nullable unique column would let NULLs duplicate — the sentinel prevents that). Submit modal shows the scope (🏪 store / 🏢 org) + sends store_id (the FE API already accepted it). **G-027 (design):** in Suriname BTW is filed per *organisation* (one BTW number) — so the consolidated return is the OA's legal duty and an SM's filing is their store's slice; when a role is store-bound everywhere else, don't let one financial feature silently widen it to org scope. +`BtwStoreScopeTest` (8); full suite 249 passing.
- **2026-06-23** — Demo polish batch: **receipt Print** printed blank → it printed a PDF *blob* in an iframe (Chrome's PDF plugin doesn't expose content to `print()`); fix = new `GET /sales/{sale}/receipt/html` (same Blade as the PDF) printed from a `srcdoc` iframe; Blade `@page size:80mm` for browser print. **Catalogue:** click-to-sort columns (search + category filter already existed); **Store Manager Stores menu removed** (backend `StorePolicy`/`OrganisationPolicy` were already SA/OA-only — it was a UI-only leak to a 403 screen). **Seeded recent Z-Reports** (last 18 days × 2 stores, sent/pending/failed + OK/short/over) so the dashboard's last-7-days view demos well; today left open for a live close. **G-028 (HTTPS / secure-context):** the camera barcode scanner (`getUserMedia`, dashboard product form) only works in a **secure context** — HTTPS or localhost. On the plain-HTTP demo (`http://<ip>:8090`) it threw a raw "getUserMedia is not defined" error; added an `isSecureContext` guard with an actionable message (use USB scanner / type the barcode). To actually enable the camera on the demo we added a **self-signed HTTPS dashboard on :8443** — a SEPARATE `dashboard-tls` nginx container (so the working :8090 is never at risk; host :80/:443 are owned by an unrelated `ams_nginx`). Deploy nuances: the cert lives in `docker/frontends/certs/` — **git-ignored, generated on the host, survives `git reset --hard`** (which doesn't touch untracked files); the dashboard is built with `VITE_REVERB_SCHEME=https` + `VITE_REVERB_PORT=8443` (deploy.env, local-only) so Echo uses `wss://…:8443/app`, proxied to `reverb:8080` (verified `101 Switching Protocols`); `VITE_API_URL=/api` stays relative so it follows the page origin (no mixed content). One build serves both :8090 and :8443.
- **2026-07-06** — **G-032 (SPA builds must carry deploy.env):** the dashboard's "Open POS in browser" launcher showed `http://localhost:5173` on the droplet. Cause: the rebrand + QR deploys rebuilt the SPAs with a plain `npx vite build`, which bakes in the DEV defaults for every `VITE_*` var — `VITE_POS_URL` (launcher), `VITE_REVERB_HOST/PORT/SCHEME` (live WebSocket updates — silently broken since the rebrand deploy), `VITE_DOCS_URL` (help links). Any droplet-bound SPA build MUST `set -a; source deploy.env; set +a` first (exactly what `scripts/deploy-server.sh` does) — or just use the script. Only `VITE_API_URL` survived by luck (its fallback is relative `/api`). Fixed by rebuilding both SPAs with the env and redeploying; verified `localhost:5173`=0 and reverb host baked into the served bundles.
- **2026-07-06** — **Convention (user feedback, standing):** client-facing docs (user_manual/, dashboard_manual/, docs/ incl. compliance, in-app help, marketing — EN+NL) must NEVER reference `CLAUDE.md`, `CLAUDE_WORKING_GUIDE.md`, `FEATURES_AND_FLOWS.md`, gotcha IDs (G-0xx), task #NN, or the AI-assisted dev process — the client's customers must not know the app was AI-built. Inline the reasoning instead of citing the registry. Product-runtime AI (ch14 AI-insights; Anthropic as subprocessor in the Verwerkersovereenkomst) is fine. Sweep grep before shipping docs; brief doc-writing subagents on this rule. Swept 2026-07-06: ch13/20/21 manuals, system-flows, 03-auth, 10-jobs, incident-response-plan (EN+NL).
- **2026-07-06** — QR-wallet payments (Mopé/Uni5Pay+) + adversarial-review fix sweep. **G-030 (payment-method fan-out):** a payment method is enumerated in ~15 independent places — Sale constants/CHECK constraint, Api+V1 validation, ReportController sums, DashboardController (JSON **and** PDF-export copies), RegisterController session agg, ZReport persisted columns, receipt Blade + ReceiptService label maps, **frontend escpos.ts thermal labels**, SalesHistory/PendingPayments/CloseRegister/EndOfDay/Reports screens (POS + dashboard), OpenAPI json **and** yaml, DemoSeeder. Adding a method = walk this list; grep `'cash', 'card', 'mixed'` and `cash_total` to find them all. Related traps fixed this round: breakdown rows gated `> 0` hid refund-negative totals (use `!= 0`); refunds of never-confirmed transfer/QR sales were allowed (now 422) and refund rows re-entered the OA pending queue (now stamped); `sessionReport` accepted any manager org-wide (now `canAccessStore`); EUR foreign-cash stamped the USD rate as its locked rate (now null); store PDF export Blade read keys the builder never produced (blank since day one — rewired). 51 backend tests on the payment path; full suite green.
- **2026-07-02** — Improvement batch off a 6-dimension read-only survey (fan-out workflow → synthesis). Survey's key finding: the app is **more complete than it looks** — ~⅓ of the "gaps" were already built (licence enforcement, the separate licence-server app, fraud heuristics, WBP-S erasure), so leverage is go-live hardening + UX, not net-new features. Shipped + live: **(correctness)** scoped `external_sale_ref` idempotency to `(api_integration_id, external_sale_ref)` — it had a *global* unique + store-only lookup and sales weren't even attributed to their integration, so two integrators reusing a ref for one store collided and silently lost a txn (+`api_integration_id` column, partial composite unique, +V1SaleIdempotencyTest). **(onboarding)** welcome-credentials email on user create — queued, bilingual, **never emails a plaintext password** (USER-04). **(dashboard)** bulk actions (Users, Discount Rules — cloned from the BTW checkbox/bulk-bar pattern), first-run onboarding checklist, shared EmptyState. **(POS)** online/offline indicator, quick-reason chips (refund/return/discrepancy), favorites/recent row (localStorage), email-receipt validation+prefill, low/out-of-stock toast, split-payment 50/70/30 presets, one-tap discount clear, "Set up printer" deep-link. **(compliance)** Verwerkersovereenkomst + OWASP Top-10 self-assessment + incident-response plan (Dutch, `docs/compliance/`). **G-029 (deploy is decoupled from git):** when `git push` was blocked by an expired PAT, the **frontends still deployed fine** — they're static `dist` rsync'd over SSH, no GitHub in the path; the **backend** normally rides `git reset` on the server but was deployed by rsyncing the specific files + running `migrate` directly. So a dead git token never blocks a demo deploy — only the GitHub history + the clean git-reset path. Also: agent fan-out for the implementation had 3 of 5 subagents drop/stall near completion (connection/stream watchdog) — always independently verify agent output (tsc/build/tests) and finish the last mile yourself; don't trust the summary. Backend 260 tests, 40 vitest, tsc+builds clean.

- **2026-07-06** — Added G-031 (glued Blade directives — `word@else`/`word@endif` are left as literal text by Blade's `\B@` regex, producing an unclosed `@if` and a fatal at render). Discovered because `GET /api/reports/export` (POS "Export PDF" button) had 500'd on every request since the initial commit: all four report PDF templates were born broken and **no feature test ever rendered a PDF** — the same-day G-030 sweep rewired `summary.blade.php`'s data keys yet the template still didn't compile, proving the point. Fix batch shipped on top of the QR-wallet release: de-glued all four blades (compile-lint sweep of all 11 templates now clean), export params now mirror the JSON sibling endpoints (monthly takes `year&month`), `type=btw` is a clean 422 until the Belastingdienst layout ships (SPOS-209), `RekenkamerController` no longer compact()s an undefined variable, and the POS export button switched from the P0-5-violating `?token=` URL (which 401'd — the reports routes never accepted query tokens) to the `openReceiptPdf` authenticated-blob pattern. `ReportPdfExportTest` (7 tests, fixtures include a qr_payment sale) + 4 new smoke probes pin all four PDF render paths. Live-walked in the browser: login → Reports → Export PDF → real `%PDF` in a new tab.

- **2026-07-18** — Created **`HANDOVER.md`** (repo root): the single continuity file for picking the project up from a fresh machine/account — live infra map (verified via `docker ps`), the five laptop-bound items git can't carry (SSH key, droplet `.env`+`APP_KEY`, GitHub access, DO panel, `deploy.env`), secrets inventory by name, status snapshot, standing user rules, doc precedence. Linked from `CLAUDE.md` read-order (item 3) and §7 here. Keep its §5 snapshot fresh when infra or gating items change. Same day: **docs-site publish-leak fix** — `AUDIT_FINDINGS*.md` and `docs-site/**` were missing from `srcExclude`, so the internal security-audit findings and the site's own README rendered onto the public docs site (`:8095/AUDIT_FINDINGS_2026-06-04.html`); added them + `HANDOVER.md` + `.claude/**` + `Phase* Tickets/**` to the exclude list and redeployed. Diagnostic gotcha from the same investigation: the docs nginx serves the SPA homepage with **HTTP 200 for ANY unknown path** — a 200 probe proves nothing; verify a leak by checking the page `<title>`/content, not the status code.

- **2026-07-18 (hardware + deps)** — **G-033: ESC/POS printers boot in code page 437** — sending Latin-1 (or UTF-8) bytes prints accent garbage on real hardware even though the browser/PDF preview looks fine, and the emulator-free dev loop never catches it. Always `ESC t <n>` a code page at INIT and encode text TO that code page (CP858 ≠ Latin-1 byte layout — é is 0xE9 in Latin-1 but 0x82 in CP858). Fixed in `frontend/src/lib/escpos.ts` (`encodeCp858Char`, byte-level unit tests). Related in the same batch: paper-width 58/80 setting (32/42 cols — hardcoded width made 58 mm printers unusable), items-derived BTW label on the thermal bon, widened scanner intake (`lib/barcode.ts`: numeric 6–14 + alphanumeric SKUs + AIM-prefix strip — the old 8–13-digit regex silently rejected UPC-E/ITF-14/Code 39), POS camera scanner (CameraScanModal, two-identical-reads guard), install-guide §F0 compatibility matrix EN+NL. **Deps sweep** (same day, commit 7bf628c): all five trees patched to latest in-range (Electron 41.7.1, Laravel 13.20, vite 7/vitest 4 parity in dashboard → 0 npm vulns both SPAs), spatie/laravel-permission 8 deliberately held (RBAC core pre-go-live), vitepress 1.6.4 (its 3 remaining advisories are dev-server-only, no fix released), license-server got platform-pin + first lock. **Test-env gotcha:** `UploadedFile::fake()->image('*.jpg')` needs GD compiled with JPEG — the docker PHP image lacks it; fabricate JPEGs from pre-encoded bytes instead (StoreWalletQrTest::tinyJpeg pattern).

- **2026-07-19 (schema audit)** — Full DB audit against live Postgres (information_schema + pg_constraint/pg_index/pg_trigger). Clean: 0 float columns (money all NUMERIC 12,2 / rates 10,4 / qty 10,3), every table has a PK, 13 CHECK constraints, rich hot-path indexes, PII encrypted casts on customers. Fixed in `2026_07_19_120001_schema_hardening…`: **(1)** 21 FK columns had no covering index (Postgres never auto-indexes FKs — sales.customer_id, discount_rules.store_id, cash_movements.store_id/user_id, btw_submissions.store_id, …); **(2)** z_reports/register_sessions/cash_movements CASCADE-deleted with their store/register/user — financial history now RESTRICT like sales (stores are soft-deleted, so pure safety net); **(3)** **audit_logs is now append-only at the DB level**: trigger rejects UPDATE/DELETE/TRUNCATE, allowing only the initial hash stamp (row_hash NULL → set, payload byte-identical via to_jsonb comparison). `audit:rebaseline` and AuditRebaselineTest lift the guard via `ALTER TABLE … DISABLE TRIGGER` (break-glass). **G-034:** a naive "block all UPDATEs" trigger would have broken every audited write — AuditHashService stamps row_hash by UPDATE right after insert; always grep for legitimate writers before locking a table down. Accepted as-is (documented, not defects): `*_srd` column naming (deliberate single-currency convention; org.currency is the future multi-currency path), `json` vs `jsonb` on 6 older blob-read columns, naive timestamps on audit_logs/register_sessions created_at (single-TZ deployment, values coherent AST; conversion risks the hash chain). 290 tests incl. new AuditLogImmutabilityTest (4); migrate:rollback/migrate round-trip verified.

- **2026-07-19 (P0 ops batch)** — Backups exist and are PROVEN: cron 03:30 AST → `scripts/backup.sh` (nightly `pg_dump -Fc` ×14 + Sunday `pg_basebackup` ×2), prod compose turns on WAL archiving to `/var/backups/josbin/wal` → PITR to any minute; `scripts/backup-restore-test.sh` restored the first dump into a scratch DB with exact row-count matches on day one; `scripts/pull-backup.sh` = laptop off-site copy. gzip on all four SPA/docs nginx (448 KB POS bundle → 146 KB on the wire). Prod PHP: `opcache.validate_timestamps=0` + FPM 12 workers via prod-compose mounts — **deploys must restart `app`** (deploy-server.sh now restarts app/horizon/scheduler). fail2ban live (sshd jail). k6 harness `scripts/load-test.js`: 10 distinct till accounts (tokens minted via tinker into gitignored `.k6-tokens.json` — logging in from k6 trips the 5/min login throttle by design); local run = 0 failures + 50-parallel-sale probe all-201 (concurrency correctness proven); contract ≤200 ms p95 must be measured on the PROD box (laptop virtiofs + default 5 FPM workers set an artificial floor — see `progress/load-test-2026-07.md`). **G-035 (real outage during rollout):** Laravel's dotenv does NOT override real container env, and compose `${VAR:-secret}` defaults interpolate from the COMPOSE-level `.env` (repo root on the server), not `backend/.env`. Old app container carried `REDIS_PASSWORD=secret` env matching Redis's weak default; recreating the container dropped that env, Laravel fell back to backend/.env's strong value → WRONGPASS 500s — exposing that Redis had run with password "secret" since day one. Fix: root `/var/www/html/.env` (0600, never in git) pins REDIS_PASSWORD/DB_* to the real values; Redis recreated with the strong password. Lesson: never ship `:-` defaults for secrets; always create the compose-level env file on servers; after any container recreate, re-verify auth paths (tinker `Redis::ping`).

---

*When in doubt, walk the journey. When still in doubt, ask.*
