# 2 — Datamodel

Wat opgeslagen is, waar, en hoe de stukjes samenhangen. Lees dit vóór elk controller-hoofdstuk — de modellaag is de taal die elk ander hoofdstuk spreekt.

---

## De models

Allemaal in `backend/app/Models/` — 24 bestanden op moment van schrijven (tel ze na, vertrouw deze zin niet). Money is `decimal:2`, time is `timestampTz` (AST), IDs zijn UUIDs tenzij anders aangegeven.

| Model | Doel | Opvallend |
|---|---|---|
| `Organisation` | De klant-tenant — één supermarktketen, één ministerie, één winkel. | `is_government` flipt elke security guard. `Auditable`. |
| `Store` | Een fysieke vestiging onder een organisatie. | `pos_type`: `native` of `external` (alleen API). `Auditable`. |
| `Register` | Een kassa binnen een vestiging. Genummerd per vestiging (`unique(store_id, number)`). | `openSession()` retourneert de enige niet-gesloten sessie, indien aanwezig. |
| `RegisterSession` | Eén dienst van een kassier op één kassa. Openingsfloat + sluitings-telling staan hier. | `status` ∈ `open/closed/reopen_requested` — reopen-goedkeuring flipt terug naar `open` met `reopen_approved_*`-stempels. |
| `CashMovement` | Een handmatige lade-beweging (pay-in/pay-out) tijdens een dienst (wisselgeld bijvullen, leverancier uit de kassa betaald). | Append-only, `$timestamps = false` (alleen `created_at`). `direction` ∈ `in/out`, `amount > 0` CHECK. Voedt de verwachte contant bij sluiting — zie [h. 6](06-register-and-z-report.md). `Auditable`. |
| `Sale` | Een voltooide (of geannuleerde/vastgehouden) transactie. | `sale_number` toegewezen via Postgres advisory lock; zeven betaalmethoden + reconciliatie-kolommen (zie hieronder); `Auditable`. |
| `SaleItem` | Eén regel op een verkoop. | `product_name_snapshot` is bevroren op moment van verkoop — product kan later hernoemd/verwijderd worden. |
| `Product` | Catalogusitem (org-breed). | `embedding` is een `vector(1536)` pgvector-kolom, default verborgen. `Auditable`. |
| `ProductVariant` | Eén maat/kleur/smaak onder een parent-product. | `SoftDeletes`. `price`/`cost_price` NULL = erf van parent (`effectivePrice()`/`effectiveCost()`). Eigen `sku`/`barcode`, per-variant `stock_qty` (org-breed voor v1). `Auditable`. |
| `Category` | Catalogusgroepering (org-breed). | Tweetalig `name_nl` / `name_en`. |
| `StoreProductOverride` | Vestigingsspecifieke prijs-override op een product. | Valt terug op `products.price` als geen rij bestaat. |
| `ProductStock` | Per-(product, vestiging) lopende voorraad. | Nieuw sinds `2026_05_25_054551`. Vervangt enkele `products.stock_qty`. |
| `StockMovement` | Append-only ledger van elke voorraadwijziging. | `bigIncrements` PK. Updates/deletes geblokkeerd op de Eloquent-laag. |
| `Customer` | Een bekende koper. | `name/phone/email/id_number` encrypted op de applicatielaag (WBP-S). |
| `User` | Een mens (of `api_integration`-machine-account). | UUID, `HasApiTokens`, `HasRoles`. `Auditable`. |
| `DailyRate` | De gelockte USD→SRD-koers voor één datum. | `date` is uniek. `locked_at` non-null = gelockt. |
| `HeldBill` | Een geparkeerde winkelwagen (cart JSON) die de kassier kan herstellen. | `cart_data` is een JSON-blob, niet een `Sale`-rij. |
| `ZReport` | End-of-day kassa-sluiting, één per vestiging per datum. | `sync_status` stuurt de offline-fallback-dans. Per-methode `*_total_srd`-kolommen voor alle zeven betaalmethoden (zie hieronder). `Auditable`. |
| `BtwSubmission` | Een formele BTW-aangifte bij Belastingdienst Suriname. | Statussen `filed/accepted/disputed/superseded`; per-org SHA-256-hash-chain (`prev_hash`/`current_hash`); store-scoped partial unique op de periode; snapshot-totalen + `sale_ids` JSONB voor traceerbaarheid. `Auditable`. Zie [h. 5](05-btw-pipeline.md). |
| `ApiIntegration` | Layer 3-client — één API key per rij. | `api_key_hash` + `webhook_secret` zijn verborgen in JSON. |
| `DiscountRule` | Discount-configuratie op catalogus/categorie/vestigingsniveau. | `Active()` + `forStore()` scopes doen de dagelijkse filtering. |
| `AuditLog` | De hash-chained, append-only audit-rij. | `bigIncrements` PK. Update + delete hooks retourneren `false`. |
| `AppSetting` | Platform-brede key/JSON-waarde-bag. | Bewaart momenteel `two_factor_required_roles`. `Auditable`. |
| `License` | Het geïnstalleerde product-licentierecord. | Stuurt de renewal-status-state-machine in `computeRenewalStatus()`. Praat met de externe license server, niet met de POS-dataflow. |

---

## Org → Store → Register → Session → Sale

De vijf-niveau-hiërarchie waar elke andere tabel onder hangt:

```
Organisation                  (one customer / tenant)
   └── Store                  (one branch)
         └── Register         (one till)
               └── RegisterSession  (one cashier's shift)
                     └── Sale       (one transaction)
                           └── SaleItem  (one line)
```

Een `Sale` draagt directe FKs helemaal omhoog — `store_id` is de primaire scoping-kolom, `register_session_id` werd later toegevoegd (`2026_04_14_100002_add_register_session_id_to_sales.php`) en is optioneel voor verkopen afkomstig van Layer 3 (API).

Cardinaliteit:

| Parent | Child | Regel |
|---|---|---|
| Organisation | Store | 1:N |
| Store | Register | 1:N — unique op `(store_id, number)` |
| Register | RegisterSession | 1:N — maar slechts één met status `open` tegelijk (afgedwongen in code, niet in schema) |
| RegisterSession | Sale | 1:N |
| Sale | SaleItem | 1:N |

De "slechts één open sessie per kassa"-regel wordt afgedwongen in `RegisterController` en de `Register::openSession()`-relatie, niet door een DB-constraint — onthoud dit als je ooit de controller omzeilt.

---

## Betalingen op `sales` — zeven methoden

`sales.payment_method` begon als `cash|card|mixed` en groeide naar zeven waarden via een gedropte-en-opnieuw-aangemaakte Postgres CHECK-constraint. De canonieke lijst is `Sale::PAYMENT_METHODS` (`backend/app/Models/Sale.php:66-70`):

```
cash · card · mixed · bank_transfer · mobile_transfer · foreign_cash · qr_payment
```

Drie migratiegolven voegden de ondersteunende kolommen toe:

| Golf | Migratie | Kolommen op `sales` |
|---|---|---|
| Card-reconciliatie | `2026_05_26_040001` | `card_bank`, `card_approval_code`, `card_terminal_ref`, `card_last_four` — allemaal optioneel, overgenomen van de PIN-terminal-bon zodat de OA card-verkopen kan matchen met het bank-settlement-overzicht. Nooit de volledige PAN (PCI blijft buiten scope). Partial index `sales_card_bank_idx`. |
| Transfers + vreemde valuta | `2026_05_26_050001` | `payment_provider`, `payment_reference`, `payment_sender_name`, `payment_confirmed_at`, `payment_confirmed_by` (FK users), `foreign_currency` (`USD`/`EUR`), `foreign_amount`, `foreign_rate_used` `decimal(10,4)`. Partial index `sales_pending_payment_idx` voor het pending-payments-scherm van de OA. |
| QR-wallets | `2026_05_26_060001` | `qr_payload` (opake provider-payload; Mopé / Uni5Pay+). Provider/referentie/bevestiging hergebruiken de golf-2-kolommen. |

De lifecycle-splitsing is `Sale::PM_PENDING_CONFIRMATION = [bank_transfer, mobile_transfer, qr_payment]`: deze settelen de lade niet op het moment van aanslaan — ze blijven pending tot de OA bevestigt dat het geld binnen is (`payment_confirmed_at`/`payment_confirmed_by`), te checken via `Sale::isAwaitingPaymentConfirmation()`. `foreign_cash` is direct lade-gesetteld: de klant betaalde fysiek USD/EUR, beide bedragen plus de gelockte koers worden opgeslagen.

Twee extra sale-kolommen zijn belangrijk voor Layer 3: `api_integration_id` (FK, gestempeld op elke API-sourced verkoop) en `external_sale_ref`, samen uniek via de partial index `sales_integration_external_ref_unique` (`2026_07_02_090001`) — idempotentie is **per integratie** gescoped, niet per vestiging. Details in [h. 8](08-integration-api.md).

Stroomafwaarts persisteert `z_reports` een per-methode-uitsplitsing: `cash_total_srd`, `card_total_srd` en — sinds `2026_07_06_090001` — `mixed_total_srd`, `bank_transfer_total_srd`, `mobile_transfer_total_srd`, `foreign_cash_total_srd`, `qr_payment_total_srd`. Vóór die migratie liet de gepersisteerde uitsplitsing vijf methoden stilzwijgend vallen en telde ze niet meer op tot `total_sales_srd` op een QR-zware dag. Details in [h. 6](06-register-and-z-report.md).

---

## Catalogus

De catalogus is **organisatiebreed**, niet per vestiging. `Product` en `Category` dragen `organisation_id`; vestigingen delen ze. Twee patronen laten een vestiging afwijken zonder de catalogus te forken:

**Prijs**: `StoreProductOverride` per `(store_id, product_id)`. `Product::priceForStore($storeId)` retourneert de override indien aanwezig, anders `products.price`:

```php
// backend/app/Models/Product.php:109-120
public function priceForStore(?string $storeId): string
{
    if (! $storeId) return (string) $this->price;
    $override = $this->storeOverrides()->where('store_id', $storeId)->first();
    return (string) ($override?->price_override ?? $this->price);
}
```

**Voorraad**: `ProductStock` per `(store_id, product_id)`. Geland in sessie 5 (migration `2026_05_25_054551_create_product_stocks_table.php`) — daarvoor was `products.stock_qty` één gedeelde counter over elke vestiging, zodat twee kassiers in twee vestigingen vanaf hetzelfde nummer konden oververkopen. Backfill creëert één rij per (product × vestiging) binnen dezelfde organisatie, geseed vanaf `products.stock_qty`.

`products.stock_qty` wordt nog bewaard als de **default initiële voorraad** die gebruikt wordt om de rij van een nieuwe vestiging te seeden bij de eerste verkoop. `Product::stockForStore($storeId)`:

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

Elke wijziging aan `product_stocks.stock_qty` gaat via `StockMovementService::record()`, die atomair een `StockMovement`-ledgerrij invoegt in dezelfde transactie. `StockMovement` blokkeert updates en deletes — zie `backend/app/Models/StockMovement.php:50-53`:

```php
static::updating(fn () => false);
static::deleting(fn () => false);
```

Dus de auditketen van verkochte hoeveelheid terug naar huidige voorraad is onbreekbaar: als de lopende totalen niet overeenkomen met de ledgersom, is het lopende totaal fout.

---

## Customer — WBP-S field-level encryption

Suriname's `Wet Bescherming Persoonsgegevens` (WBP-S) eist dat persoonsgegevens onleesbaar zijn at rest. Het `Customer`-model regelt dit op de applicatielaag met `Crypt::encryptString` (AES-256, key uit `APP_KEY`):

| Kolom | Opslag | Hoe |
|---|---|---|
| `name` | encrypted text | `setNameAttribute` / `getNameAttribute` |
| `phone` | encrypted text | `setPhoneAttribute` / `getPhoneAttribute` |
| `email` | encrypted text | `setEmailAttribute` / `getEmailAttribute` |
| `id_number` | encrypted text | `setIdNumberAttribute` / `getIdNumberAttribute` |
| `name_hash` | `hash_hmac('sha256', lower(name), APP_KEY)` | voor lookup |
| `phone_hash` | `hash_hmac('sha256', phone, APP_KEY)` | voor lookup |

De hashes zijn een bewuste concessie: encryptie alleen zou naam/telefoon-lookups onmogelijk maken. HMAC-SHA256 met de app key geeft een deterministisch, niet-omkeerbaar token bruikbaar als `WHERE`-clause. De `scopeSearchByName`- en `scopeSearchByPhone`-methodes (`backend/app/Models/Customer.php:91-103`) hashen de input en matchen tegen de kolom-index.

`total_spend_srd` en `visit_count` zijn aggregate-only — geen PII — en leven in plaintext voor rapporten.

Directe DB-toegang levert niets leesbaars op. Verlies `APP_KEY` en je verliest elk customer-record permanent — backup hem apart van de database.

---

## AuditLog + AuditHashService — append-only chain

Twee lagen van onveranderlijkheid:

**1. Eloquent-laag.** `AuditLog::booted()` registreert `updating`- en `deleting`-hooks die stilletjes `false` retourneren:

```php
// backend/app/Models/AuditLog.php:77-85
static::updating(function () { return false; });
static::deleting(function () { return false; });
```

`->save()` en `->delete()` op een bestaande rij worden no-ops. Directe `DB::table('audit_logs')->update()` zou dit omzeilen — maar elk codebase-pad gaat via `AuditLog::create([...])`.

**2. Cryptografische laag.** Elke rij draagt:

| Kolom | Betekenis |
|---|---|
| `previous_row_hash` | De `row_hash` van de vorige rij voor dezelfde `organisation_id`. |
| `row_hash` | `SHA-256(organisation_id \| event \| auditable_type \| auditable_id \| new_values \| created_at \| previous_row_hash)` |

De keten is per-organisatie — elke org is een onafhankelijk ledger zodat de load van de ene org de verificatie van een andere niet kan vertragen. `AuditHashService::verifyChain($organisationId)` (`backend/app/Services/AuditHashService.php:61-99`) loopt elke rij in `id`-volgorde af, herberekent de verwachte hash, en meldt de eerste ID die niet matcht.

```
chain integrity:
  row N    previous_row_hash ──┐
                                ▼
  row N+1  previous_row_hash = row N.row_hash
           row_hash = sha256(self || previous_row_hash)
```

Het wijzigen of verwijderen van een rij breekt de keten vanaf dat punt voorwaarts — aantoonbaar, met `php artisan audit:verify`.

De onderliggende tabel is `audit_logs` (owen-it/laravel-auditing's default), schema vastgeschroefd door twee migrations:

- `2026_04_12_121306_create_audits_table.php` — vendor migration; bigint PK, morphs-kolommen, JSON old/new values.
- `2026_04_13_000001_fix_audits_table_for_uuid.php` — converteert `user_id` en `auditable_id` van `bigint` naar `text` omdat de rest van het schema UUIDs gebruikt.
- `2026_04_14_000001_add_row_hash_to_audit_logs.php` — voegt `organisation_id`, `previous_row_hash`, `row_hash` en de `audit_chain_idx`-traversal-index toe.

---

## DailyRate — één koers per dag, vastgezet

De USD→SRD-koers die het hele systeem gebruikt voor een bepaalde dag. Opgehaald om 06:00 AST van ExchangeRate-API; handmatig overschrijfbaar. `date` is `unique`, dus er is precies één rij per kalenderdag.

| Veld | Waarom |
|---|---|
| `usd_to_srd` | De koers die het systeem toepast. `decimal(10,4)`. |
| `raw_rate` | Het response van de API vóór markup — bewaard voor audit. |
| `markup_pct` | Optionele markup bovenop `raw_rate`. |
| `source` | `api` of `manual`. |
| `locked_by` / `locked_at` | Wie deze koers vastzette en wanneer. `locked_at IS NOT NULL` betekent dat hij niet automatisch overschreven kan worden door de volgende API-fetch. |
| `api_response` | Ruwe JSON van de API-call. Voor audit. |

`Sale::exchange_rate_used` wordt gestempeld vanuit `DailyRate::todayRate()->usd_to_srd` op het moment van schrijven — dus retroactief een koers bewerken (zelfs als het zou kunnen) herschrijft de geschiedenis niet.

`DailyRate::todayRate()` valt terug op de meest recente vorige koers als die van vandaag nog niet is opgehaald — dit is het vangnet als de API om 06:00 onbereikbaar is.

---

## AppSetting — per-platform JSON-bag

Een enkele `key → jsonb value`-tabel voor runtime-policy-instellingen die niet bij één organisatie horen. Migration `2026_05_23_000001_create_app_settings_table.php`.

```php
AppSetting::set('two_factor_required_roles', ['organisation_admin', 'auditor']);
$roles = AppSetting::get('two_factor_required_roles', []);
```

Momenteel is `two_factor_required_roles` de enige key in gebruik, geschreven door `SecurityPolicyController` en gelezen door `User::requires2FA()`. `AppSetting` is `Auditable`, dus policy-wijzigingen zijn manipulatiebestendig.

Dit is **geen** per-org settings-store — die rol is verdeeld tussen `stores.settings` (JSON) en `organisations.*`-kolommen. AppSetting is platform-breed en momenteel Super-Admin-only.

---

## Money — DECIMAL(12,2) en bcmath

Elke monetaire kolom is `DECIMAL(12,2)` aan de Postgres-kant en krijgt een `'decimal:2'`-cast in het model zodat Eloquent je een string aanreikt. **Laad nooit een prijs in een PHP-float.** Floats kunnen 0.10 niet exact representeren; één BTW-afrondingsfout maakt een Belastingdienst-aangifte ongeldig.

Alle arithmetic gebruikt bcmath via `BtwCalculationService`:

```php
// backend/app/Services/BtwCalculationService.php (excerpt)
bcadd($a, $b, 2);
bcmul($price, $qty, 4);   // 4dp internally, round to 2 at boundary
```

De `decimal(12,2)`-keuze geeft tien cijfers links van de decimaal — genoeg voor `99,999,999.99 SRD`, meer dan elke plausibele enkele transactie.

Twee kolommen wijken af:

| Kolom | Precisie | Waarom |
|---|---|---|
| `daily_rates.usd_to_srd` | `decimal(10,4)` | Wisselkoersen hebben vier decimalen nodig. |
| `products.quantity` etc. | `decimal(10,3)` | Hoeveelheid ondersteunt 0.001 kg. |

---

## Time — timestamptz, AST overal

Elke timestamp-kolom is `timestampTz` (Postgres `timestamp with time zone`). `config/app.php` zet de app-tijdzone op `America/Paramaribo` (AST, UTC-3). Carbon defaults vloeien van daaruit.

Postgres slaat `timestamptz` intern op als UTC en converteert bij in- en uitlezen — dus het databasebestand is portabel over tijdzones, maar elke PHP/JS-read retourneert AST.

Een handvol timestamps wordt expliciet geschreven om de AST-interpretatie vast te leggen — bv. `AuditLog::booted()` zet `created_at = now()` (wat Carbon in AST retourneert) in plaats van te vertrouwen op Postgres' `DEFAULT NOW()`. Dit is van belang voor de audit hash-keten: de hash bevat `created_at->toIso8601String()`, wat dezelfde bytes moet produceren wanneer opnieuw berekend.

---

## IDs — UUID op het operationele schema

Elke operationele tabel heeft een UUID primary key. Models gebruiken Laravels `HasUuids`-trait (`Illuminate\Database\Eloquent\Concerns\HasUuids`), die de UUID in PHP genereert vóór insert. Migrations zetten ook Postgres-side defaults op `gen_random_uuid()` voor de gevallen waar rijen worden aangemaakt via raw SQL (zie de `product_stocks`-backfill).

Laravels `HasUuids`-default is UUID v4 (random). Niets in `backend/app/Models/` overschrijft `newUniqueId()` of `uniqueIds()`, dus IDs zijn niet lexicografisch sorteerbaar op creatietijd. Als je creatie-volgorde nodig hebt, sorteer dan op `created_at` (of `id` op de bigint-uitzonderingen hieronder).

**Uitzonderingen** — tabellen die auto-increment bigint PKs houden omdat hun volume of vendor-afkomst UUID onnodig maken:

| Tabel | PK-type | Waarom |
|---|---|---|
| `audit_logs` | `bigIncrements` (vendor: owen-it/laravel-auditing) | Hoge write volume; hash chain geeft uniqueness-garanties die de PK niet nodig heeft. |
| `stock_movements` | `bigIncrements` | Hetzelfde — append-only ledger, geen cross-row referenties nodig. |
| `personal_access_tokens` | `bigIncrements` (vendor: Sanctum) | Token-rijen zijn kortlevend; performance > UUID. |
| `permissions`, `roles`, `model_has_*` | `bigIncrements` (vendor: spatie/laravel-permission) | Vendor-schema, behouden as-is. |
| `app_settings` | `id()` bigint | Kleine tabel, key-based lookup, geen FKs naar binnen. |
| `password_reset_tokens` | string PK op email | Vendor-schema. |

Foreign keys naar UUID-tabellen zijn zelf `uuid`-kolommen. FKs naar `users` zijn uuid omdat `2026_04_12_200000_convert_users_id_to_uuid.php` de bigint PK omzet naar `uuid` vóór de rest van het schema wordt gebouwd. Sanctum's `personal_access_tokens.tokenable_id` wordt verbreed van `bigint` naar `text` in dezelfde migration zodat het een UUID-string kan bevatten.

---

## Multi-tenancy

`composer.json` bevat `stancl/tenancy: ^3.10` en het is geïnstalleerd — maar het runtime-schema is **niet** tenant-per-database. Elke operationele rij draagt een `organisation_id` foreign key en isolatie wordt afgedwongen door:

1. **Controller scoping.** Elke query die user-supplied IDs raakt voegt `->where('organisation_id', $user->organisation_id)` toe of loopt via een policy.
2. **De `StoreBelongsToOrg`-validatieregel** (`backend/app/Rules/StoreBelongsToOrg.php`). Voordat deze regel landde, werd `store_id` gevalideerd met `exists:stores,id` — wat betekende dat een kassier van org A `store_id` van org B kon POSTen en de API accepteerde dat. De regel vereist nu dat de `organisation_id` van de vestiging matcht met die van de caller, met Super Admin als enige bypass.
3. **`SalePolicy::ownsSale`** (`backend/app/Policies/SalePolicy.php:50-53`). Per-verkoop reads/voids/refunds checken `$sale->store->organisation_id === $user->organisation_id`. Super Admin omzeilt via de `before()`-hook.

Zowel #2 als #3 sloten echte cross-org lekken die ontdekt werden in de sessie-5-audit. Documenteer ze als de "eerste verdedigingslinie" — ze zitten vóór elk endpoint dat een store- of sale-ID neemt.

`stancl/tenancy` blijft beschikbaar voor een toekomstige migratie naar echte database-per-tenant (gepland voor SaaS-schaal), maar voorlopig zijn zijn tabellen niet actief.

---

## Snelle referentie — kolom-conventies

| Kolom-suffix | Type | Opmerkingen |
|---|---|---|
| `*_srd` | `decimal(12,2)` | Alle money. Behandel als string in PHP. |
| `*_rate` | `decimal(5,2)` of `decimal(10,4)` | Percentages of FX-koersen. |
| `*_at` | `timestampTz` nullable | Event-timestamp, AST. |
| `*_id` | `uuid` | FK naar een uuid PK. |
| `*_by` | `uuid` | FK naar `users.id`. |
| `*_hash` | `string(64)` | SHA-256 hex (HMAC of chain hash). |
| `is_*` | `boolean` | Default-`true` voor `is_active`, anders `false`. |

---

→ [3 — Auth & rollen](03-auth-and-roles.md)
