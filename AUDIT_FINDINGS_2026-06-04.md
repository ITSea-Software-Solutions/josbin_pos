# Audit findings — 2026-06-04

Five parallel auditors swept the codebase (security, data integrity,
performance, UX, compliance). 60+ findings; this page triages them so
we can fix the dangerous ones before the demo and queue the rest.

Severity scale:
- **🔴 CRITICAL** — silent data corruption, money loss, or compliance breach. Fix first.
- **🟠 HIGH** — exploitable / breaks at scale / cashier-facing bug.
- **🟡 MEDIUM** — quality gap, polish, hardening.
- **🔵 LOW** — nits.

Effort: **S** ≤ 1 hr · **M** half day · **L** 1–2 days · **XL** 3+ days.

---

## 🔴 P0 — fix before next demo (silent loss / compliance breach)

| # | Area | Finding | Effort |
|---|------|---------|--------|
| **P0-1** | sales | **Stock decrement runs in a queued job AFTER commit** (`SaleController.php:335`). If the queue is down or the job fails, the sale is recorded but stock is never decremented. Two concurrent sales of the last unit both succeed → oversell. **Fix:** move `StockMovementService::recordSale` inside the same `DB::transaction` block. | M |
| **P0-2** | sales | **`max(0.0, …)` silent clamp on oversell** (`StockMovementService.php:71`). Audit ledger goes mathematically inconsistent (Σ qty_change ≠ current stock) and no exception is raised. Cashier and Z-Report show success while customer leaves with a phantom item. **Fix:** throw `InsufficientStockException`, abort the sale txn; never silently clamp. | S |
| **P0-3** | sales | **Variant stock can go negative** (`SaleController.php:277-281`). `lockForUpdate()->first()` then `decrement()` doesn't use the locked snapshot; no DB CHECK on `product_variants.stock_qty >= 0`. **Fix:** add CHECK constraints on `product_variants.stock_qty` and `product_stocks.stock_qty`; explicit guarded update inside the lock. | M |
| **P0-4** | compliance | **BTW submission hash chain is org-global** (`BtwSubmissionService.php:125`). One org's filing creates a hash link in another org's sequence — verify-chain breaks unpredictably and `prev_hash` proves nothing. **Fix:** scope `getLastHash` to `organisation_id`, order by `id` not `submitted_at`. | S |
| **P0-5** | security | **`?token=` query auth accepts full 12h wildcard tokens** (`AuthenticateViaQueryToken.php:26-42`). Token ends up in webserver access logs / browser history / Referer headers; full account takeover if anyone reads logs. Receipt-PDF links are shared by email. **Fix:** issue short-lived `receipt:{sale_id}` ability tokens; reject `*` in this middleware. | M |
| **P0-6** | security | **Cross-tenant PII leak via guessed `customer_id`** (`SaleController.php:45,433`). Validation is `exists:customers,id` with no org scope; a cashier in Org A can attach a Customer UUID from Org B to a sale, then receipt decrypts and prints that customer's WBP-S-protected name/phone/email. **Fix:** `Rule::exists('customers','id')->where('organisation_id', $orgId)`. | S |
| **P0-7** | compliance | **WBP-S "right to erasure" is unimplemented** for `Customer`. No DELETE/redact endpoint. **Fix:** add `DELETE /customers/{id}` that nulls encrypted PII + hash columns and writes `customer.redacted` to audit log; keep the row + counters so reports stay intact. | M |
| **P0-8** | compliance | **`Customer` model is not Auditable** despite carrying every encrypted PII field. WBP-S § access-log requirement says PII reads/writes must be traceable; today they aren't. **Fix:** `implements Auditable` + `use Auditable` on Customer; explicit `accessed` event on `CustomerController::show`. | S |
| **P0-9** | compliance | **`whereDate` uses session TZ (UTC)**, not AST (`ReportController.php:267`). Sales rung 21:00–23:59 AST on the last day of a BTW period silently fall into the next day. Monthly BTW totals leak/lose end-of-day revenue. **Fix:** either `DATE(occurred_at AT TIME ZONE 'America/Paramaribo')` or set `'timezone' => 'America/Paramaribo'` in config/database.php. Same TZ bug throughout reports. | M |
| **P0-10** | compliance | **Audit hash chain bypassed by `DB::table('audit_logs')->insert()`** in 8+ places (BtwSubmissionController, AuthController, UserController, SaleController, LicenseController, DailyRateService, MeController). Each raw insert writes NULL `row_hash`; verify-chain treats them as gaps so genuine tampering looks like normal gaps. **Fix:** replace all with `AuditLog::create(...)`; add a Postgres trigger that rejects inserts with NULL `row_hash`. | M |

**P0 total: ~3 days of focused work.** Demo-blocking.

---

## 🟠 P1 — fix this sprint (exploitable, scale-breaking, or daily-friction)

### Security
| # | Finding | Effort |
|---|---------|--------|
| P1-S1 | **`webhook_secret` stored plaintext** (`ApiIntegration.php`). DB read / backup theft discloses every integrator's HMAC secret → forged webhooks. **Fix:** `'webhook_secret' => 'encrypted'` cast. | S |
| P1-S2 | **SVG logo upload XSS** (`StoreController.php:85`). SVG carries inline JS; served same-origin → stored XSS in any dashboard surface rendering the logo. **Fix:** drop `svg` from mime allow-list or sanitize via `enshrined/svg-sanitize`. | S |
| P1-S3 | **`reset2fa` requires no step-up** (`UserController.php:287`). Hijacked OA session can clear 2FA on every SM/cashier in the org via one API call. No audit row, no email. **Fix:** require `current_password`, write audit_log, send email; block against roles in `TWO_FACTOR_ALWAYS_ROLES`. | S |
| P1-S4 | **`sanctum.expiration = null`** is a footgun. Any future `createToken('foo', ['*'])` without explicit `expiresAt` lives forever. **Fix:** set `SANCTUM_EXPIRATION=720` (12h) as backstop. | S |
| P1-S5 | **Void/refund have no per-endpoint throttle.** Compromised cashier can void/refund the entire day in a tight loop. **Fix:** `throttle:10,1` on `void`+`refund` routes; trip `DetectSaleAnomaly` inline when count > N/min. | S |
| P1-S6 | **Login throttle only counts FAILED attempts and rotates with IP+email key.** Attacker rotating IPs defeats it; "progressive delays" promised in spec aren't implemented. **Fix:** secondary per-IP limiter; `usleep(2^attempts)` for first 8 attempts. | S |
| P1-S7 | **`EnsureTwoFactor` middleware exists but is never applied** to any protected route. 2FA enforces at login, but a stolen Sanctum token after that bypasses the `2fa_verified` ability check. **Fix:** wrap the authenticated route group in `['auth:sanctum', 'two_factor', 'session.timeout']`. | S |

### Data integrity
| # | Finding | Effort |
|---|---------|--------|
| P1-D1 | **`Sale::nextNumber()` advisory lock is useless if called outside a txn.** Two concurrent first-sales of the day can compute the same sale_number → unique-index crash 500. **Fix:** assert `DB::transactionLevel() > 0` at top; or use per-store Postgres SEQUENCE. | S |
| P1-D2 | **`customer.total_spend_srd` casts to float** (`SaleController.php:326-328`). All other money is BCMath/DECIMAL. Aggregated LTV drifts vs `SUM(sales.total_srd)`. **Fix:** `update(['total_spend_srd' => DB::raw('total_spend_srd + ?')], [$stringTotal])`. | S |
| P1-D3 | **Refund leg loses original discount info** (`SaleController.php:546-600`). Refund sale_items hard-code `discount_srd='0.00'`; BTW report double-counts the original discount on partial refunds. **Fix:** reuse `BtwCalculationService::calculateLineItem` with negated qty. | M |
| P1-D4 | **`DailyRateService::updateOrCreate` can race on first-sale-of-day.** Two terminals both call the API, both `updateOrCreate`, the second overwrites the first's `usd_to_srd`. Two audit events for one date. **Fix:** wrap in `DB::transaction` with `lockForUpdate` `firstOrCreate`; or `INSERT … ON CONFLICT DO NOTHING RETURNING`. | S |
| P1-D5 | **`sale_discount_pct` silently dropped** when discount rules also produce a cart discount (`SaleController.php:200-208`). Cashier thinks customer got 10% off + loyalty rule; system applied only the loyalty rule. **Fix:** combine before calling the BTW service, or change the service to additively combine. | S |

### Performance (the 200ms budget at scale)
| # | Finding | Effort |
|---|---------|--------|
| P1-P1 | **`stockForStore()` N+1 on POS startup.** `$this->storeStocks()->where(...)->first()` re-queries DB per product. At 5000 products × 10 terminals starting = 50k extra queries on `/api/products/pos`. **Fix:** use the loaded collection — `$this->storeStocks->firstWhere('store_id', $storeId)` (no `()`). 5-line change. | S |
| P1-P2 | **`/api/products/pos` returns ALL active products unpaginated** with every storeStocks row eager-loaded. At 50 stores × 10k SKUs = 500k product_stocks rows pulled into PHP per terminal startup. OOM risk. **Fix:** constrain eager-load to requesting `store_id`; paginate 500 + incremental `updated_since` sync. | M |
| P1-P3 | **`whereDate('occurred_at', ...)` defeats `(store_id, occurred_at)` index** in dashboard summary, store detail, every report. At 1M+ rows the planner switches to seq scan. **Fix:** sweep `whereDate` → `whereBetween($from, $toEndOfDay)`. 10–100× perf gain on reports. | M |
| P1-P4 | **`storeDetail` runs 9 sequential queries** every 60 seconds × N dashboards. Several use function-wrapped TZ casts → cannot use index. **Fix:** add expression index `(store_id, DATE(occurred_at AT TIME ZONE 'America/Paramaribo'))` OR rewrite as `BETWEEN`. | M |
| P1-P5 | **`SaleCompleted` broadcasts to BOTH `store.` AND `org.` channels.** Org channel: 50 stores × 1k tx/day = 50k events fanned to every dashboard user. **Fix:** drop the `store.` channel (POS doesn't need echo) or throttle org-channel to 1 aggregated tick/sec. | S |
| P1-P6 | **`StockMovementService::recordSale` does Product::find + lockForUpdate inside the loop.** 20-item basket = 60+ queries inside the txn, row-locks for entire duration; concurrent cashiers serialise. **Fix:** batch-load products + single bulk UPDATE + bulk INSERT of movements. | M |

### UX
| # | Finding | Effort |
|---|---------|--------|
| P1-U1 | **POS has no global keyboard shortcuts.** Cashier must mouse-click for Pay/Hold/Customer/Discount/New sale. Friday-evening killer. **Fix:** `useHotkeys` on POSScreen — F1=customer, F2=hold, F3=discount, F9=pay, Esc=close modal, F12=keyboard. Document in cheat-sheet. | M |
| P1-U2 | **POS `handleHoldBill` swallows errors** (`POSScreen.tsx:69-71`). Network drops → bill silently lost. Same in `downloadSurapos` for the Layer-4 USB export — silent failure in a compliance fallback. **Fix:** shared `useToast()` hook; surface every error. | S |
| P1-U3 | **Destructive actions use browser `confirm()`** (UsersScreen, OrganisationsScreen, CatalogueScreen, ApiKeysScreen, etc.). Inconsistent with StoresScreen's styled modal; breaks in some Electron contexts. **Fix:** reuse `ConfirmDeactivate` pattern; surface what will happen ("3 cashiers will lose POS access"). | M |
| P1-U4 | **Dashboard modals lack Escape-to-close & focus-trap.** Universal "get me out" instinct fails. **Fix:** create shared `dashboard/components/Modal.tsx` mirroring POS's; migrate all dashboard modals. | M |
| P1-U5 | **`StoreDetailScreen` has no back button.** Only exit is sidebar — loses scroll position on parent. **Fix:** add `onBack` like `BtwSubmissionDetailScreen`. | S |
| P1-U6 | **i18n discipline** — ~1175 inline `isNl ? 'Dutch' : 'English'` ternaries instead of `t()`. Inverts the "instant per-user language switch + add Sranantongo via a translation file" promise from CLAUDE.md. **Fix:** migrate to keys progressively (one screen per PR); ESLint rule banning string literals in JSX. | XL |

### Compliance
| # | Finding | Effort |
|---|---------|--------|
| P1-C1 | **BTW exempt-vs-taxable split inferred from `sale.btw_srd == 0`** (`BtwSubmissionService.php:73`). Mixed basket misclassifies entire sale as taxable. **Fix:** aggregate from `sale_items` where `btw_exempt = true`. | S |
| P1-C2 | **`btw_submissions.status` is updated in-place; hash never recomputed.** Tamper-evidence claim in manual ch 20 is overstated. **Fix:** either insert "event" rows (append-only history) or recompute hash on every status change + add a `status_history` JSONB column. | M |
| P1-C3 | **Voided sales are not immutable.** Plain `$sale->update(...)` works post-void; only the OwenIt audit_log captures it. **Fix:** model `updating` hook that throws on `getOriginal('status') === 'voided'`; PG trigger as belt-and-braces. | S |
| P1-C4 | **Audit-log OA scoping filters by `WHERE user_id IN (org_users)`, not `audit_logs.organisation_id`.** System events with `user_id=NULL` are invisible to OA; SA actions on the org's data are also hidden. **Fix:** filter on `audit_logs.organisation_id = ?` (OR `user_id IN (...)` for legacy nulls). | S |
| P1-C5 | **Daily-rate row is not append-only.** `DailyRateService::updateOrCreate` overwrites a locked rate; sales snapshot the rate (good) but Rekenkamer cross-check of `daily_rates` itself fails. **Fix:** model `updating` hook blocking change when `locked_at IS NOT NULL` unless `manual_override=true`. | S |
| P1-C6 | **Receipts without `btw_number` still print.** Belastingdienst expects every BTW-charging receipt to carry a number. **Fix:** block `SaleController::store` when org non-exempt and `organisation.btw_number` is null; Settings-screen warning. | S |

**P1 total: ~2 weeks at one engineer.**

---

## 🟡 P2 — queue for the polish pass

(28 findings — too long to enumerate here. Highlights:)

- **Audit-log search uses `ILIKE '%term%'` on TEXT JSON column.** Full scan on every search; convert to `jsonb` + GIN, or `pg_trgm`.
- **`product_stocks` low-stock check uses `whereRaw('stock_qty <= low_stock_threshold')`** — can't use any index. Add generated column `is_low` with partial index.
- **`ZReport::orderByDesc('report_date')->get()->unique('store_id')`** pulls every Z-report ever written. Switch to `DISTINCT ON (store_id)`.
- **`AuthController::checkGeoAlert`** calls `http://ip-api.com` over plaintext. Leaks government login IPs to a third-party in cleartext. Switch to HTTPS + token.
- **`User::$fillable` includes `role`/`organisation_id`/`is_active`**. Future `User::create($request->all())` would let an attacker elevate. Move them to `$guarded`.
- **CORS pattern matches `http://localhost:*` in production** too. Local app on POS terminal could call production API on a logged-in user. Gate behind `app()->environment('local')`.
- **`tax_inspector` has `audit.view` but the controller filter must restrict to events touching their BTW reviews.** Verify with a feature test.
- **`reports.consolidated` PDF "per-store" rows drop org name** — confusing for SA who deals with multiple orgs.
- **`AuditLogScreen` search has no debounce** + no client highlight.
- **`StockScreen` MovementHistory** modal hardcodes `per_page=50` with no pagination → silent truncation on popular SKUs.
- **`SalesHistoryScreen.tsx:91`** uses `.slice(0,10)` on `toISOString()` → "today" rolls over at 22:00 AST (UTC midnight).
- **`Customer.scopeSearchByName`** HMAC of `mb_strtolower($value)` without NFKD/diacritic strip → "José" vs "jose" misses → duplicate customers (compounds PII exposure).
- **IVFFlat index built on empty table** at migration time; PG16 supports HNSW. Switch + `REINDEX` post-seed.
- **`SyncExportController`** loads entire date range of sales+items into memory then `json_encode`. Stream/chunk + cap at 30 days + gzip before encryption.
- **`CustomerController::store`** lets cashier write `id_number` (WBP-S protected). Restrict to manager+; strip on cashier creates.
- **Per-item `category_id` lookup is N+1** in cart build; batch-load before the map.

---

## 🔵 P3 — nits & cleanup

- `where('auditable_type','like','%Sale')` leading wildcard — use exact FQCN.
- Tab labels in `ReportsScreen` defined inline, not via `t()`.
- DashboardOverview uses "Winkels" / "Winkeldetails" while every other screen uses "Vestiging(en)".
- `sale_items.product_id` has `nullOnDelete` but products uses SoftDeletes — FK only fires on `forceDelete`; document + test that "Top Products" handles null `product_id`.
- `BtwSubmissionController` supersede appends "[Superseded by …]" but overwrites the inspector's original dispute note.

---

## Suggested order (best ROI first)

1. **P0-1 + P0-2 + P0-3** together — same `SaleController` file, one PR, ~3 hours. Eliminates the oversell + ledger-inconsistency class entirely.
2. **P1-P1** (stockForStore N+1) — 5-line fix, instantly unlocks POS startup at scale. Should land same day.
3. **P0-9 + P0-10 + P0-4 + P1-C1** — compliance correctness pass (TZ, hash chain, BTW split). Half a day.
4. **P0-5 + P0-6 + P1-S1 → P1-S7** — security hardening sweep. One day.
5. **P0-7 + P0-8 + P1-C5 + P1-C6 + P1-C4** — WBP-S + Rekenkamer compliance pass. One day.
6. **P1-P3 + P1-P4** — `whereDate` → `whereBetween` sweep. Half a day, massive scaling win.
7. **P1-U1 + P1-U2 + P1-U3 + P1-U4** — UX polish before demo. Two days.
8. P2 polish + P1-U6 (i18n) becomes a continuous background refactor.

Total to close all P0+P1: roughly two engineer-weeks. P0 alone is ~3 days and unlocks the demo.
