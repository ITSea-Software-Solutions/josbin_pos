# 2 — Data model

What's stored, where, and how the pieces hang together. Read this before any controller chapter — the model layer is the language every other chapter speaks.

---

## The models

All live in `backend/app/Models/` — 24 files at the time of writing (count them, don't trust this sentence). Money is `decimal:2`, time is `timestampTz` (AST), IDs are UUIDs unless flagged otherwise.

| Model | Purpose | Notable |
|---|---|---|
| `Organisation` | The customer tenant — one supermarket chain, one ministry, one shop. | `is_government` flips every security guard. `Auditable`. |
| `Store` | A physical branch under an organisation. | `pos_type`: `native` or `external` (API-only). `Auditable`. |
| `Register` | A till inside a store. Numbered per store (`unique(store_id, number)`). | `openSession()` returns the one non-closed session, if any. |
| `RegisterSession` | One cashier's shift on one register. Opening float + close-out cash counts live here. | `status` ∈ `open/closed/reopen_requested` — reopen approval flips back to `open` with `reopen_approved_*` stamps. |
| `CashMovement` | A manual drawer pay-in/pay-out during a shift (change top-up, supplier paid from till). | Append-only, `$timestamps = false` (`created_at` only). `direction` ∈ `in/out`, `amount > 0` CHECK. Feeds expected cash at close — see [ch 6](06-register-and-z-report.md). `Auditable`. |
| `Sale` | A completed (or voided/held) transaction. | `sale_number` allocated via Postgres advisory lock; seven payment methods + reconciliation columns (see below); `Auditable`. |
| `SaleItem` | One line on a sale. | `product_name_snapshot` is frozen at sale time — product can be renamed/deleted later. |
| `Product` | Catalogue item (org-wide). | `embedding` is a `vector(1536)` pgvector column, hidden by default. `Auditable`. |
| `ProductVariant` | One size/colour/flavour under a parent product. | `SoftDeletes`. `price`/`cost_price` NULL = inherit parent (`effectivePrice()`/`effectiveCost()`). Own `sku`/`barcode`, per-variant `stock_qty` (org-wide for v1). `Auditable`. |
| `Category` | Catalogue grouping (org-wide). | Bilingual `name_nl` / `name_en`. |
| `StoreProductOverride` | Per-store price override on a product. | Falls back to `products.price` when no row exists. |
| `ProductStock` | Per-(product, store) running stock. | New as of `2026_05_25_054551`. Replaces single `products.stock_qty`. |
| `StockMovement` | Append-only ledger of every stock change. | `bigIncrements` PK. Updates/deletes blocked at the Eloquent layer. |
| `Customer` | A known buyer. | `name/phone/email/id_number` encrypted at app layer (WBP-S). |
| `User` | A human (or `api_integration` machine account). | UUID, `HasApiTokens`, `HasRoles`. `Auditable`. |
| `DailyRate` | The locked USD→SRD rate for one date. | `date` is unique. `locked_at` non-null = locked. |
| `HeldBill` | A parked basket (cart JSON) the cashier can restore. | `cart_data` is a JSON blob, not a `Sale` row. |
| `ZReport` | End-of-day register close, one per store per date. | `sync_status` drives the offline-fallback dance. Per-method `*_total_srd` columns for all seven payment methods (see below). `Auditable`. |
| `BtwSubmission` | A formal BTW filing to Belastingdienst Suriname. | Statuses `filed/accepted/disputed/superseded`; per-org SHA-256 hash chain (`prev_hash`/`current_hash`); store-scoped partial unique on the period; snapshot totals + `sale_ids` JSONB for traceability. `Auditable`. See [ch 5](05-btw-pipeline.md). |
| `ApiIntegration` | Layer 3 client — one API key per row. | `api_key_hash` + `webhook_secret` are hidden in JSON. |
| `DiscountRule` | Catalogue/category/store-level discount config. | `Active()` + `forStore()` scopes do the day-to-day filtering. |
| `AuditLog` | The hash-chained, append-only audit row. | `bigIncrements` PK. Update + delete hooks return `false`. |
| `AppSetting` | Platform-wide key/JSON value bag. | Currently stores `two_factor_required_roles`. `Auditable`. |
| `License` | The installed product licence record. | Drives the renewal-status state machine in `computeRenewalStatus()`. Talks to the external licence server, not the POS data flow. |

---

## Org → Store → Register → Session → Sale

The five-level hierarchy every other table hangs off:

```
Organisation                  (one customer / tenant)
   └── Store                  (one branch)
         └── Register         (one till)
               └── RegisterSession  (one cashier's shift)
                     └── Sale       (one transaction)
                           └── SaleItem  (one line)
```

A `Sale` carries direct FKs all the way up — `store_id` is the primary scoping column, `register_session_id` was added later (`2026_04_14_100002_add_register_session_id_to_sales.php`) and is optional for sales originating from Layer 3 (API).

Cardinality:

| Parent | Child | Rule |
|---|---|---|
| Organisation | Store | 1:N |
| Store | Register | 1:N — unique on `(store_id, number)` |
| Register | RegisterSession | 1:N — but only one with status `open` at a time (enforced in code, not schema) |
| RegisterSession | Sale | 1:N |
| Sale | SaleItem | 1:N |

The "only one open session per register" rule is enforced in `RegisterController` and the `Register::openSession()` relation, not by a DB constraint — keep this in mind if you ever bypass the controller.

---

## Payments on `sales` — seven methods

`sales.payment_method` started as `cash|card|mixed` and grew to seven values via a dropped-and-recreated Postgres CHECK constraint. The canonical list is `Sale::PAYMENT_METHODS` (`backend/app/Models/Sale.php:66-70`):

```
cash · card · mixed · bank_transfer · mobile_transfer · foreign_cash · qr_payment
```

Three migration waves added the supporting columns:

| Wave | Migration | Columns on `sales` |
|---|---|---|
| Card reconciliation | `2026_05_26_040001` | `card_bank`, `card_approval_code`, `card_terminal_ref`, `card_last_four` — all optional, copied from the PIN-terminal slip so the OA can match card sales to the bank settlement statement. Never the full PAN (PCI stays out of scope). Partial index `sales_card_bank_idx`. |
| Transfers + foreign cash | `2026_05_26_050001` | `payment_provider`, `payment_reference`, `payment_sender_name`, `payment_confirmed_at`, `payment_confirmed_by` (FK users), `foreign_currency` (`USD`/`EUR`), `foreign_amount`, `foreign_rate_used` `decimal(10,4)`. Partial index `sales_pending_payment_idx` for the OA's pending-payments screen. |
| QR wallets | `2026_05_26_060001` | `qr_payload` (opaque provider payload; Mopé / Uni5Pay+). Provider/reference/confirmation reuse the wave-2 columns. |

The lifecycle split is `Sale::PM_PENDING_CONFIRMATION = [bank_transfer, mobile_transfer, qr_payment]`: these don't settle the drawer when rung — they sit pending until the OA confirms the funds landed (`payment_confirmed_at`/`payment_confirmed_by`), checked via `Sale::isAwaitingPaymentConfirmation()`. `foreign_cash` is drawer-settled immediately: the customer paid physical USD/EUR, both amounts plus the locked rate are stored.

Two more sale columns matter to Layer 3: `api_integration_id` (FK, stamped on every API-sourced sale) and `external_sale_ref`, unique together via the partial index `sales_integration_external_ref_unique` (`2026_07_02_090001`) — idempotency is scoped **per integration**, not per store. Details in [ch 8](08-integration-api.md).

Downstream, `z_reports` persists a per-method breakdown: `cash_total_srd`, `card_total_srd` and — since `2026_07_06_090001` — `mixed_total_srd`, `bank_transfer_total_srd`, `mobile_transfer_total_srd`, `foreign_cash_total_srd`, `qr_payment_total_srd`. Before that migration the persisted breakdown silently dropped five methods and no longer summed to `total_sales_srd` on a QR-heavy day. Details in [ch 6](06-register-and-z-report.md).

---

## Catalogue

The catalogue is **organisation-wide**, not per-store. `Product` and `Category` carry `organisation_id`; stores share them. Two patterns let a store deviate without forking the catalogue:

**Price**: `StoreProductOverride` per `(store_id, product_id)`. `Product::priceForStore($storeId)` returns the override if present, otherwise `products.price`:

```php
// backend/app/Models/Product.php:109-120
public function priceForStore(?string $storeId): string
{
    if (! $storeId) return (string) $this->price;
    $override = $this->storeOverrides()->where('store_id', $storeId)->first();
    return (string) ($override?->price_override ?? $this->price);
}
```

**Stock**: `ProductStock` per `(store_id, product_id)`. Landed in session 5 (migration `2026_05_25_054551_create_product_stocks_table.php`) — before this, `products.stock_qty` was one shared counter across every branch, so two cashiers at two branches could oversell from the same number. Backfill creates one row per (product × store) within the same organisation, seeded from `products.stock_qty`.

`products.stock_qty` is kept around as the **default initial stock** used to seed a new store's row on first sale. `Product::stockForStore($storeId)`:

```php
// backend/app/Models/Product.php:72-83
public function stockForStore(?string $storeId): string
{
    if (! $storeId) {
        return (string) $this->storeStocks()->sum('stock_qty');
    }
    $row = $this->storeStocks()->where('store_id', $storeId)->first();
    return (string) ($row?->stock_qty ?? $this->stock_qty);
}
```

Every change to `product_stocks.stock_qty` goes through `StockMovementService::record()`, which atomically inserts a `StockMovement` ledger row in the same transaction. `StockMovement` blocks updates and deletes — see `backend/app/Models/StockMovement.php:50-53`:

```php
static::updating(fn () => false);
static::deleting(fn () => false);
```

So the audit chain from sold-quantity back to current-on-hand is unbreakable: if the running totals disagree with the ledger sum, the running total is wrong.

---

## Customer — WBP-S field-level encryption

Suriname's `Wet Bescherming Persoonsgegevens` (WBP-S) demands that personal data be unreadable at rest. The `Customer` model handles this at the application layer with `Crypt::encryptString` (AES-256, key from `APP_KEY`):

| Column | Storage | How |
|---|---|---|
| `name` | encrypted text | `setNameAttribute` / `getNameAttribute` |
| `phone` | encrypted text | `setPhoneAttribute` / `getPhoneAttribute` |
| `email` | encrypted text | `setEmailAttribute` / `getEmailAttribute` |
| `id_number` | encrypted text | `setIdNumberAttribute` / `getIdNumberAttribute` |
| `name_hash` | `hash_hmac('sha256', lower(name), APP_KEY)` | for lookup |
| `phone_hash` | `hash_hmac('sha256', phone, APP_KEY)` | for lookup |

The hashes are a deliberate concession: encryption alone would make name/phone lookups impossible. HMAC-SHA256 with the app key gives a deterministic, non-reversible token usable as a `WHERE` clause. The `scopeSearchByName` and `scopeSearchByPhone` methods (`backend/app/Models/Customer.php:91-103`) hash the input and match against the column index.

`total_spend_srd` and `visit_count` are aggregate-only — not PII — and live in plaintext for reports.

Direct DB access yields nothing readable. Lose `APP_KEY` and you lose every customer record permanently — back it up separately from the database.

---

## AuditLog + AuditHashService — append-only chain

Two layers of immutability:

**1. Eloquent layer.** `AuditLog::booted()` registers `updating` and `deleting` hooks that silently return `false`:

```php
// backend/app/Models/AuditLog.php:77-85
static::updating(function () { return false; });
static::deleting(function () { return false; });
```

`->save()` and `->delete()` on an existing row become no-ops. Direct `DB::table('audit_logs')->update()` would bypass this — but every codebase path goes through `AuditLog::create([...])`.

**2. Cryptographic layer.** Every row carries:

| Column | Meaning |
|---|---|
| `previous_row_hash` | The `row_hash` of the prior row for the same `organisation_id`. |
| `row_hash` | `SHA-256(organisation_id \| event \| auditable_type \| auditable_id \| new_values \| created_at \| previous_row_hash)` |

The chain is per-organisation — each org is an independent ledger so one org's load can't slow another's verification. `AuditHashService::verifyChain($organisationId)` (`backend/app/Services/AuditHashService.php:61-99`) walks every row in `id` order, recomputes the expected hash, and reports the first ID that fails to match.

```
chain integrity:
  row N    previous_row_hash ──┐
                                ▼
  row N+1  previous_row_hash = row N.row_hash
           row_hash = sha256(self || previous_row_hash)
```

Modifying or deleting any row breaks the chain from that point forward — provably, with `php artisan audit:verify`.

The underlying table is `audit_logs` (owen-it/laravel-auditing's default), schema bolted on by two migrations:

- `2026_04_12_121306_create_audits_table.php` — vendor migration; bigint PK, morphs columns, JSON old/new values.
- `2026_04_13_000001_fix_audits_table_for_uuid.php` — converts `user_id` and `auditable_id` from `bigint` to `text` because the rest of the schema uses UUIDs.
- `2026_04_14_000001_add_row_hash_to_audit_logs.php` — adds `organisation_id`, `previous_row_hash`, `row_hash`, and the `audit_chain_idx` traversal index.

---

## DailyRate — one rate per day, locked in

The USD→SRD rate the entire system uses for a given day. Fetched at 06:00 AST from ExchangeRate-API; manually overridable. `date` is `unique`, so there is exactly one row per calendar day.

| Field | Why |
|---|---|
| `usd_to_srd` | The rate the system applies. `decimal(10,4)`. |
| `raw_rate` | The API's response before markup — kept for audit. |
| `markup_pct` | Optional markup applied on top of `raw_rate`. |
| `source` | `api` or `manual`. |
| `locked_by` / `locked_at` | Who froze this rate and when. `locked_at IS NOT NULL` means it cannot be auto-overwritten by the next API fetch. |
| `api_response` | Raw JSON of the API call. For audit. |

`Sale::exchange_rate_used` is stamped from `DailyRate::todayRate()->usd_to_srd` at write time — so retroactively editing a rate (even if you could) does not rewrite history.

`DailyRate::todayRate()` falls back to the most recent past rate if today's hasn't been fetched yet — this is the safety net when the API is unreachable at 06:00.

---

## AppSetting — per-platform JSON bag

A single `key → jsonb value` table for runtime policy settings that don't belong to any one organisation. Migration `2026_05_23_000001_create_app_settings_table.php`.

```php
AppSetting::set('two_factor_required_roles', ['organisation_admin', 'auditor']);
$roles = AppSetting::get('two_factor_required_roles', []);
```

Currently the only key in use is `two_factor_required_roles`, written by `SecurityPolicyController` and read by `User::requires2FA()`. `AppSetting` is `Auditable`, so policy changes are tamper-evident.

This is **not** a per-org settings store — that role is split between `stores.settings` (JSON) and `organisations.*` columns. AppSetting is platform-wide and currently Super-Admin-only.

---

## Money — DECIMAL(12,2) and bcmath

Every monetary column is `DECIMAL(12,2)` Postgres-side and gets a `'decimal:2'` cast in the model so Eloquent hands you a string. **Never load a price into a PHP float.** Floats can't represent 0.10 exactly; one BTW rounding error makes a Belastingdienst filing fail.

All arithmetic uses bcmath via `BtwCalculationService`:

```php
// backend/app/Services/BtwCalculationService.php (excerpt)
bcadd($a, $b, 2);
bcmul($price, $qty, 4);   // 4dp internally, round to 2 at boundary
```

The `decimal(12,2)` choice gives ten digits left of the decimal — enough for `99,999,999.99 SRD`, more than any plausible single transaction.

Two columns deviate:

| Column | Precision | Why |
|---|---|---|
| `daily_rates.usd_to_srd` | `decimal(10,4)` | Exchange rates need four decimal places. |
| `products.quantity` etc. | `decimal(10,3)` | Quantity supports 0.001 kg. |

---

## Time — timestamptz, AST everywhere

Every timestamp column is `timestampTz` (Postgres `timestamp with time zone`). `config/app.php` sets the app timezone to `America/Paramaribo` (AST, UTC-3). Carbon defaults flow from there.

Postgres stores `timestamptz` as UTC internally and converts on the way in and out — so the database file is portable across timezones, but every PHP/JS read returns AST.

A handful of timestamps are written explicitly to lock the AST interpretation in place — e.g. `AuditLog::booted()` sets `created_at = now()` (which Carbon returns in AST) rather than relying on Postgres's `DEFAULT NOW()`. This matters for the audit hash chain: the hash includes `created_at->toIso8601String()`, which must produce the same bytes when re-computed.

---

## IDs — UUID on the operational schema

Every operational table has a UUID primary key. Models use Laravel's `HasUuids` trait (`Illuminate\Database\Eloquent\Concerns\HasUuids`), which generates the UUID in PHP before insert. Migrations also set Postgres-side defaults to `gen_random_uuid()` for the cases where rows are created via raw SQL (see the `product_stocks` backfill).

Laravel's `HasUuids` default is UUID v4 (random). Nothing in `backend/app/Models/` overrides `newUniqueId()` or `uniqueIds()`, so IDs are not lexicographically sortable by creation time. If you need creation order, sort by `created_at` (or `id` on the bigint exceptions below).

**Exceptions** — tables that keep auto-increment bigint PKs because their volume or vendor lineage make UUID unnecessary:

| Table | PK type | Why |
|---|---|---|
| `audit_logs` | `bigIncrements` (vendor: owen-it/laravel-auditing) | High write volume; hash chain provides uniqueness guarantees that the PK doesn't need to. |
| `stock_movements` | `bigIncrements` | Same — append-only ledger, no cross-row references needed. |
| `personal_access_tokens` | `bigIncrements` (vendor: Sanctum) | Token rows are short-lived; performance > UUID. |
| `permissions`, `roles`, `model_has_*` | `bigIncrements` (vendor: spatie/laravel-permission) | Vendor schema, kept as-is. |
| `app_settings` | `id()` bigint | Tiny table, key-based lookup, no FKs in. |
| `password_reset_tokens` | string PK on email | Vendor schema. |

Foreign keys to UUID tables are themselves `uuid` columns. FKs into `users` are uuid because `2026_04_12_200000_convert_users_id_to_uuid.php` swaps the bigint PK to `uuid` before the rest of the schema is built. Sanctum's `personal_access_tokens.tokenable_id` is widened from `bigint` to `text` in the same migration so it can hold a UUID string.

---

## Multi-tenancy

`composer.json` includes `stancl/tenancy: ^3.10` and it's installed — but the runtime schema is **not** tenant-per-database. Every operational row carries an `organisation_id` foreign key and isolation is enforced by:

1. **Controller scoping.** Every query that touches user-supplied IDs adds `->where('organisation_id', $user->organisation_id)` or runs through a policy.
2. **The `StoreBelongsToOrg` validation rule** (`backend/app/Rules/StoreBelongsToOrg.php`). Before this rule landed, `store_id` was validated with `exists:stores,id` — meaning a cashier from org A could POST `store_id` belonging to org B and the API accepted it. The rule now requires the store's `organisation_id` to match the caller's, with Super Admin as the only bypass.
3. **`SalePolicy::ownsSale`** (`backend/app/Policies/SalePolicy.php:50-53`). Per-sale reads/voids/refunds check `$sale->store->organisation_id === $user->organisation_id`. Super Admin bypasses via the `before()` hook.

Both #2 and #3 closed real cross-org leaks discovered in the session-5 audit. Document them as the "first line of defence" — they sit in front of every endpoint that takes a store or sale ID.

`stancl/tenancy` remains available for a future migration to true database-per-tenant (planned for SaaS scale), but for now its tables are not active.

---

## Quick reference — column conventions

| Column suffix | Type | Notes |
|---|---|---|
| `*_srd` | `decimal(12,2)` | All money. Treat as string in PHP. |
| `*_rate` | `decimal(5,2)` or `decimal(10,4)` | Percentages or FX rates. |
| `*_at` | `timestampTz` nullable | Event timestamp, AST. |
| `*_id` | `uuid` | FK to a uuid PK. |
| `*_by` | `uuid` | FK to `users.id`. |
| `*_hash` | `string(64)` | SHA-256 hex (HMAC or chain hash). |
| `is_*` | `boolean` | Default-`true` for `is_active`, else `false`. |

---

→ [3 — Auth & roles](03-auth-and-roles.md)
