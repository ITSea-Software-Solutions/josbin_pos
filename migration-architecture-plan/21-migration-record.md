# 21. Migration to the three-node architecture

The decision record and the feature-by-feature disposition for splitting Josbin
POS into three nodes. [Chapter 19](/migration-architecture-plan/19-three-node-architecture) is the
target shape and [chapter 20](/migration-architecture-plan/20-split-build-plan) is the order of work —
**this chapter is what was decided and where every feature lands.**

Nothing here is a proposal. These are settled calls, with the reasoning kept so
that a future reader can tell a decision from an accident.

---

## 21.1 Decisions taken

### D1 — One node per shop, and the schema stays as it is

One shop, one database, one node. Cashiers are logins on that node; any Windows
machine in the shop runs the Docker server and the tills connect to it over the
shop LAN.

**But `organisation_id` and `store_id` stay in the schema**, with exactly one row
in each. Tempting to collapse them; wrong to do it:

- Those columns thread through 65 migrations and most of the shipped features.
  Removing them is an enormous diff whose only reward is tidiness — and it would
  break the freeze list wholesale.
- The sync payload stays naturally addressable: the control plane already knows
  which organisation and store a node speaks for.
- A shop that later becomes two, or a chain that wants a node per branch, needs
  no migration.

**Collapse the deployment, not the schema.** That is what keeps the early steps a
pure refactor.

*Consequence to plan for:* one database per shop plus only rollups syncing upward
means a dead disk loses that shop's trading history. Automated local backup and
the existing USB export path are part of the install, not an afterthought.

### D2 — Never lock a paying customer out, and offer real escrow

Two mechanisms, for two different fears.

**Degrade, don't lock (default behaviour).** If a node cannot reach the licence
server for months *and* its token has expired, it goes read-only. Reports,
exports and BTW filings keep working; only new sales stop. The client's data is
never held hostage — that was already the stated position, and this makes it
structural.

**Source-code escrow (for the government deal).** Source deposited with a
Paramaribo agent, released on defined triggers — vendor insolvency, or a defined
period without support response. A ministry will ask for this; having the answer
ready is worth more than the paperwork costs.

A **perpetual licence token** is also available commercially. It is not a rescue
procedure and not a separate mechanism — it is the same signed token issued with
no expiry, given deliberately at end of contract or as a paid tier. The shop
does nothing different: same key, same activation screen, same offline check.
It stays hardware-fingerprint-bound, so a leaked perpetual token is not a free
licence for anyone else.

### D3 — We host the tax node, as a genuinely separate system

Hosting must not quietly become "same Postgres, different schema" — that would
falsify the compliance claim. Separate means:

- Its **own database instance**, not a schema inside the commercial one
- Its **own application deployment**, credentials and backups
- **No network route** from the commercial stack — separate Docker network at
  minimum, separate VPS preferably
- Its own audit log, including every time our team touches it

**This makes us a data processor for the Belastingdienst under WBP-S.** The
verwerkersovereenkomst stops being paperwork and becomes the thing that makes
hosting lawful. Maintenance access must be named, logged and time-boxed — not a
standing root login.

It also strengthens the case for direct filing (D4): hosting the box *and* being
in the filing path would expose us twice.

### D4 — BTW is filed direct, shop-signed

Shop → tax node, signed by the shop so the filing is provably theirs and
unaltered. Only a **receipt** comes back to the control plane: filed yes/no,
reference, timestamp — **no amounts**. We operate the machine without sitting in
the chain of custody of the submission.

### D5 — Layer 3 lives in the control plane, and it is not the shop LAN

These are different things and conflating them causes real confusion:

| | What it is | Internet |
|---|---|---|
| **Shop LAN** | *Our* tills → *their* local server | **None. Ever.** |
| **Layer 3 API** | *Someone else's* POS software → Josbin | Theirs, not the shop's |

Layer 3 is the open integration API — a **different vendor's** POS pushing its
sales in for consolidation and BTW. It has nothing to do with a cashier ringing
a sale.

Putting it in the control plane costs the shop nothing and **removes** code from
the offline node. A shop node has no fixed public address; an integrator cannot
be asked to discover a dynamic IP, and wants one endpoint and one key rather than
one per shop. If a shop is offline the control plane holds the pushed sale and
forwards it — the reverse has no recovery at all.

### D6 — One control database plus per-shop encrypted archives

Not a database per organisation. The shop node is now the **system of record**;
our cloud holds a derived copy, and that copy serves two jobs that want opposite
storage.

**Control database** (one, org-scoped rows) — organisations, licences, node
health, daily rollups, Z-reports, BTW receipts, our own staff accounts. This is
the dashboard's entire diet: a 200-shop fleet is megabytes a year, and
consolidated reporting is one ordinary query.

**Per-shop encrypted archive** (object storage, not a database) — the node's
nightly encrypted dump, uploaded when internet allows. Cheap, never migrated,
and unreadable by us, which is a feature rather than a limitation.

Database-per-tenant was the right call when our cloud held everything. It is the
wrong call now: 200 organisations would mean 200 migrations every release,
readable copies of every shop's customer data (reversing the decision that PII
stays local), and cross-store reporting as a fan-out instead of a `WHERE`.
Row-level security on one control database gives the isolation without the fleet
of schemas.

*The care point:* if the archive key is held only by the shop and they lose it,
the backup is worthless and we get blamed. If we hold it, "we cannot see your
data" evaporates. Practical middle — encrypt per shop, escrow the key in the
control plane **separately from the archive storage**, log every use, and state
it in the DPA.

---

## 21.2 The two boundaries that matter

**Offline boundary — what a sale actually touches**

<svg viewBox="0 0 680 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Three tills on the shop LAN connect to a local Docker server; internet is optional and used only for activation, licence renewal, sync and BTW filing" style="max-width:680px;width:100%;height:auto;font-family:sans-serif">
  <rect x="14" y="14" width="360" height="228" rx="12" fill="#f7f9fc" stroke="#293371" stroke-width="2" stroke-dasharray="7 5"/>
  <text x="30" y="36" font-size="12" font-weight="700" fill="#293371">SHOP LAN — no internet required</text>
  <rect x="34" y="52" width="96" height="40" rx="8" fill="#ffffff" stroke="#293371" stroke-width="2"/>
  <text x="82" y="77" text-anchor="middle" font-size="12" fill="#111827">🖥 Till 1</text>
  <rect x="34" y="102" width="96" height="40" rx="8" fill="#ffffff" stroke="#293371" stroke-width="2"/>
  <text x="82" y="127" text-anchor="middle" font-size="12" fill="#111827">🖥 Till 2</text>
  <rect x="34" y="152" width="96" height="40" rx="8" fill="#ffffff" stroke="#293371" stroke-width="2"/>
  <text x="82" y="177" text-anchor="middle" font-size="12" fill="#111827">📱 Till 3</text>
  <line x1="130" y1="72" x2="212" y2="118" stroke="#293371" stroke-width="2"/>
  <line x1="130" y1="122" x2="212" y2="124" stroke="#293371" stroke-width="2"/>
  <line x1="130" y1="172" x2="212" y2="130" stroke="#293371" stroke-width="2"/>
  <rect x="212" y="94" width="146" height="62" rx="10" fill="#293371"/>
  <text x="285" y="118" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff">🗄 Shop node</text>
  <text x="285" y="136" text-anchor="middle" font-size="10.5" fill="#c9d2ee">any Windows PC + Docker</text>
  <rect x="34" y="204" width="324" height="26" rx="6" fill="#e9f7ef"/>
  <text x="196" y="222" text-anchor="middle" font-size="12" fill="#1d7a46">✅ sale · receipt · drawer · Z-report — all local</text>
  <line x1="374" y1="125" x2="424" y2="125" stroke="#9aa3b8" stroke-width="2" stroke-dasharray="4 4"/>
  <text x="399" y="116" text-anchor="middle" font-size="10" fill="#6b7280">optional</text>
  <rect x="424" y="30" width="240" height="190" rx="12" fill="#ffffff" stroke="#9aa3b8" stroke-width="1.8"/>
  <text x="544" y="52" text-anchor="middle" font-size="12" font-weight="700" fill="#6b7280">☁️ INTERNET — when it exists</text>
  <text x="440" y="80" font-size="11.5" fill="#111827">• activation ·········· once, a few kB</text>
  <text x="440" y="104" font-size="11.5" fill="#111827">• licence renewal ····· rarely, a few kB</text>
  <text x="440" y="128" font-size="11.5" fill="#111827">• sync upward ········· 50–200 kB/day</text>
  <text x="440" y="152" font-size="11.5" fill="#111827">• BTW filing ·········· monthly</text>
  <text x="440" y="176" font-size="11.5" fill="#111827">• encrypted backup ···· nightly, queues</text>
  <rect x="438" y="188" width="212" height="24" rx="6" fill="#fdf1e7"/>
  <text x="544" y="205" text-anchor="middle" font-size="11" fill="#b35400">none of these blocks a sale</text>
</svg>

**Storage boundary — what our cloud actually keeps**

<svg viewBox="0 0 680 210" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="The shop node is the system of record; rollups go to one control database and encrypted archives go to object storage" style="max-width:680px;width:100%;height:auto;font-family:sans-serif">
  <rect x="14" y="66" width="164" height="78" rx="10" fill="#293371"/>
  <text x="96" y="94" text-anchor="middle" font-size="13" font-weight="700" fill="#ffffff">🗄 Shop node</text>
  <text x="96" y="112" text-anchor="middle" font-size="10.5" fill="#c9d2ee">SYSTEM OF RECORD</text>
  <text x="96" y="130" text-anchor="middle" font-size="10.5" fill="#c9d2ee">every sale, every line</text>
  <line x1="178" y1="92" x2="286" y2="60" stroke="#293371" stroke-width="2.5"/>
  <polygon points="286,60 275,59 279,69" fill="#293371"/>
  <text x="196" y="72" font-size="10.5" font-weight="600" fill="#293371">rollups</text>
  <line x1="178" y1="120" x2="286" y2="152" stroke="#1d7a46" stroke-width="2.5"/>
  <polygon points="286,152 275,143 279,153" fill="#1d7a46"/>
  <text x="192" y="147" font-size="10.5" font-weight="600" fill="#1d7a46">encrypted dump</text>
  <rect x="290" y="14" width="216" height="92" rx="10" fill="#ffffff" stroke="#293371" stroke-width="2.5"/>
  <text x="398" y="36" text-anchor="middle" font-size="12.5" font-weight="700" fill="#111827">Control database — ONE</text>
  <text x="304" y="56" font-size="11" fill="#111827">organisations · licences · nodes</text>
  <text x="304" y="74" font-size="11" fill="#111827">daily_rollups · z_reports</text>
  <text x="304" y="92" font-size="11" fill="#111827">btw_receipts · control_users</text>
  <rect x="290" y="118" width="216" height="80" rx="10" fill="#ffffff" stroke="#1d7a46" stroke-width="2.5"/>
  <text x="398" y="140" text-anchor="middle" font-size="12.5" font-weight="700" fill="#0e1a14">Object storage</text>
  <text x="304" y="160" font-size="11" fill="#0e1a14">one encrypted archive per shop</text>
  <text x="304" y="178" font-size="11" fill="#0e1a14">never migrated · we cannot read it</text>
  <rect x="522" y="30" width="144" height="60" rx="8" fill="#eef1f9"/>
  <text x="594" y="52" text-anchor="middle" font-size="11" fill="#293371">megabytes a year</text>
  <text x="594" y="70" text-anchor="middle" font-size="11" fill="#293371">for 200 shops</text>
  <rect x="522" y="128" width="144" height="60" rx="8" fill="#e9f7ef"/>
  <text x="594" y="150" text-anchor="middle" font-size="11" fill="#1d7a46">disaster recovery</text>
  <text x="594" y="168" text-anchor="middle" font-size="11" fill="#1d7a46">key escrowed apart</text>
</svg>

---

## 21.3 Every feature, and where it goes

**220 catalogued features** — every row in the feature catalogue, including the
13 cross-cutting ones that belong to no area. The counts are the point:

| Disposition | Count | Meaning |
|---|---|---|
| 🏪 **Shop** | **97** | Moves cleanly into the node |
| ⚠️ **Splits** | **70** | Exists in two nodes — **where behaviour gets lost** |
| ☁️ **Control** | **23** | Stays in our cloud |
| ◆ **All three** | **18** | Each node needs its own |
| 🏛 **Tax** | **12** | Belastingdienst-facing; moves whole |

**70 is the number to worry about.** A feature that moves to one node
either works or obviously doesn't. A feature that splits is where each side
assumes the other kept the behaviour, and nobody notices for a month.

The worst-affected area is BTW filing: 12 of its 29 features split, and
that is the one place where being wrong is a compliance finding rather than a
bug report.

Status column: ✅ shipped · 🟡 partial · 🔲 not started.

### POS — register & sales  ·  43 features

| ID | Feature | Now | Goes to | Note |
|---|---|---|---|---|
| `POS-01` | Auto-route to single assigned store (skip picker) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-02` | Open register with cash float | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-03` | Auto-select single register on open | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-04` | Multi-cashier concurrent selling on different registers | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-05` | Register session close (per-shift) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-06` | Manager re-opens closed register for next shift | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-07` | Add to cart by tap / barcode / search | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-08` | Edit line price / qty / BTW / discount mid-sale | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-09` | Item-level discount (% or fixed SRD) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-10` | Sale-level discount (% or fixed SRD) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-11` | Cash payment + numpad + change calc | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-12` | Card/PIN payment | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-12a` | Card payment reconciliation fields (bank / approval / last-4 / terminal ref) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-13` | Mixed payment (cash + card) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-13a` | Mixed-payment reconciliation panel (collapsible, when card portion > 0) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-13b` | bank_transfer payment method (B2B / government invoiced sales) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-13c` | mobile_transfer payment method (DSB Mobiel, Hakrinbank Online, etc.) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-13d` | foreign_cash payment method (USD/EUR with locked daily rate) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-13e` | Pending-payments queue + OA confirmation flow (with audit log) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-13f` | QR-wallet payments (Mopé / Uni5Pay+) — POS step + instant till-confirmation +… | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-13g` | QR webhook endpoint stub (HMAC-ready, feature-flagged off) | 🟡 | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-14` | ESC/POS thermal receipt print | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-15` | Cash drawer pulse on cash sale | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-15a` | Manual cash in/out (pay-in / pay-out) during shift → adjusts Z-Report expecte… | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-16` | PDF receipt download | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-17` | Email receipt (bilingual HTML) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-17a` | Receipt via WhatsApp — wa.me deep link with a compact text receipt (items ≤15… | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-18` | Hold bill / restore later | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-19` | Void sale (manager approval) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-20` | Refund sale (partial or full) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-20a` | Return without original sale (blind return) — manager-gated, BTW extracted, s… | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-21` | On-the-fly customer add (name / phone / email) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-22` | Today's sales total + count on POS toolbar | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-23` | Language toggle (NL ↔ EN) instant | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-24` | On-screen keyboard toggle (touchscreen) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-25` | POS auto-launch on system boot | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-26` | Close + Restart buttons (manager-gated) | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-27` | Settings persist per-device | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-28` | Daily USD→SRD rate lock screen | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-29` | Manual rate override | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-30` | Morning recovery — "Yesterday was never closed" gate: stale previous-day sess… | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-31` | Closing-time nudge — per-store closing_time: amber POS strip past closing, on… | ✅ | 🏪 Shop | Selling path. Never leaves the node. |
| `POS-32` | Opt-in overnight auto-close — per-store auto_close_enabled+auto_close_time: f… | ✅ | 🏪 Shop | Selling path. Never leaves the node. |

### Catalogue & inventory  ·  23 features

| ID | Feature | Now | Goes to | Note |
|---|---|---|---|---|
| `CAT-01` | Product CRUD (centralised by default) | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-02` | Category CRUD (icon + sort_order + i18n) | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-03` | Per-product BTW rate + exempt flag | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-04` | Per-store price override | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-05` | Bulk import (CSV) | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-06` | Bulk import (Excel/XLSX) | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-07` | Import template download | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-08` | 📡 Push catalogue to POS (WebSocket broadcast) | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-09` | Product image upload (JPEG/PNG/WebP, 2 MB max) | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-10` | Per-store stock via product_stocks table | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-11` | Stock movement ledger (append-only, decremented in the sale transaction) | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-11b` | Oversell policy per org (block_oversell, default OFF = allow + track negative) | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-12` | Stock-history endpoint per product | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-13` | Low-stock threshold (low_stock_threshold per product) | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-14` | Low-stock alert badge on dashboard | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-15` | Low-stock badge on POS product grid | 🟡 | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-16` | Discount rules (product / category / cart) | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-17` | Barcode scanner — USB/Bluetooth HID (keyboard wedge). Enter-lookup accepts nu… | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-18` | Barcode scanner — camera (Quagga2) on the dashboard product form. Requires a … | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-18a` | Barcode scanner — camera on the POS (📷 next to search): same reader set, acce… | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-19` | Product table — click-to-sort columns (name/SKU/category/price/cost/BTW/stock… | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-19` | Bulk barcode label printing — platform-routed print: Android → native PrintMa… | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |
| `CAT-20` | Weighed-goods / scale barcodes (embedded price or weight EAN-13) — configurab… | ✅ | 🏪 Shop | Catalogue is local; HQ push arrives over sync. |

### Settings & device  ·  24 features

| ID | Feature | Now | Goes to | Note |
|---|---|---|---|---|
| `SET-01` | Printer config UI (network TCP / USB / Android PrintManager) + paper width 80… | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-01a` | Thermal receipts encode CP858 (ESC t 19) — é/ë/ó/ñ print correctly on ESC/POS… | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-02` | Org-configurable payment pick-lists: wallets / card banks / transfer banks / … | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-02` | Cash drawer pin config (Pin 2 / Pin 5) | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-03` | Hardware test buttons — test receipt (real buildReceiptBytes→printEscPos sale… | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-04` | Date format selector (6 options, NL default DD-MM-YYYY) | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-05` | Default BTW rate / category / customer | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-06` | Barcode symbology default (EAN-13 / Code 128 / UPC-A) | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-07` | Site name customisation (POS top bar) | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-08` | Vendor contact (Josbin name/email/phone) on all "contact support" surfaces | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-10` | POS installer download from the store's OWN dashboard (GET /installer metadat… | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `HW-x` | Printer bridge — Windows app shares its USB receipt printer on TCP 9100 ("📡 S… | ✅ | 🏪 Shop | Printer, drawer, scanner — physically local. |
| `REG-x` | Self-service shift handover (org policy, default off) — with it on, the next … | ✅ | 🏪 Shop | Register lifecycle is local. |
| `SALE-13` | Sale-level BTW exemption (vrijstelling) — govt/diplomatic/export buyers pay e… | ✅ | 🏪 Shop | Selling path. |
| `SET-12` | Native Android POS app (Capacitor 8, minSdk 24) for Android till terminals (P… | 🟡 | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-11` | Server-address panel on the POS-app screen — shows the exact address a till m… | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-09` | Role-aware sectioned dashboard navigation (industry-standard SaaS admin layou… | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-10` | Runtime-configurable server address — josbin_server_url localStorage override… | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-11` | Sranantongo POS UI (draft) — third language srn, 390 keys, fallback srn→nl→en… | 🟡 | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-12` | Per-store end-of-day settings — closing_time, auto_close_enabled, auto_close_… | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-13` | Night / Day screen theme (per till, not per user — a property of where the te… | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-14` | User menu on the POS top bar — tap your name for role, store, language (NL/EN… | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `SET-15` | Drawn product glyphs — 15 category illustrations replace the single 📦 on tile… | ✅ | 🏪 Shop | Device settings local; org policy in Control. |
| `HW-y` | **Direct USB printing on Android** (USB Host API, native plugin) | ✅ | 🏪 Shop | Till hardware. Never leaves the node. |

### Reports  ·  16 features

| ID | Feature | Now | Goes to | Note |
|---|---|---|---|---|
| `REP-01` | Daily sales report (per store) | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-02` | Monthly sales report | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-03` | Custom date-range report | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-04` | Top products by revenue | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-05` | X-Report (mid-day snapshot, no close) | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-06` | Z-Report (end-of-day close + cash recon) | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-07` | Z-Report 7-day history | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-08` | Z-Report submit to HQ (manual force-sync) | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-09` | BTW report (per-store, Belastingdienst format) | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-10` | BTW report (consolidated cross-store) | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-11` | Rekenkamer audit export (signed PDF + CSV) | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-12` | Report PDF export (daily / monthly / custom, store-level) — was 500-broken si… | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-13` | Cross-store consolidated dashboard (live SRD totals via WebSocket) | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-14` | Custom product report builder | 🟡 | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-15` | Payment-method × bank/provider breakdown on daily / monthly / custom reports | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |
| `REP-16` | Platform Overview panel for Super Admin (cross-tenant KPIs, licence health bu… | ✅ | ⚠️ Splits | Own-store / consolidated / filings — three homes. |

### BTW filings to the Belastingdienst  ·  29 features

The most split area in the product, and the reason the tax node exists. Sixteen
of the twenty-nine move whole — twelve are cut in half, and one needs a copy in
every node.

| ID | Feature | Now | Goes to | Note |
|---|---|---|---|---|
| `BTW-FILING-01` | `tax_inspector` role — cross-organisation, read-only, BTW-only | ✅ | 🏛 Tax | The role has no meaning in a shop or in control. It exists in one node only. |
| `BTW-FILING-02` | Mandatory 2FA for tax_inspector (government account) | ✅ | 🏛 Tax | Policy travels with the role, so it travels to the tax node. |
| `BTW-FILING-03` | Daily BTW submission | ✅ | ⚠️ **Splits** | Shop computes and signs; tax receives. Two halves, two nodes. |
| `BTW-FILING-04` | Monthly BTW submission (formal filing) | ✅ | ⚠️ **Splits** | Same wire as daily. The period is the only difference. |
| `BTW-FILING-05` | Preview totals before filing (dry-run) | ✅ | 🏪 Shop | Reads the shop’s own sales. Never crosses a wire. |
| `BTW-FILING-06` | Snapshot totals at filing time (never recomputed) | ✅ | 🏪 Shop | The snapshot is what makes a filing defensible. It is taken shop-side. |
| `BTW-FILING-07` | Sale-ID traceability per filing (jsonb array) | ✅ | 🏪 Shop | Sale IDs are shop-local. The tax node gets totals per rate, not lines — see 19.5. |
| `BTW-FILING-08` | Auto-generated filing reference (BTW-YYYY-MM-ORG-DAY-NNN) | ✅ | ⚠️ **Splits** | Shop mints it; tax must treat it as the key. Both sides must agree on the format forever. |
| `BTW-FILING-09` | Idempotency: one filing per (org, period_type, range) | ✅ | ⚠️ **Splits** | Today one database enforces it. Split, **both** sides must — a retry after a timeout is the normal case, not the edge case. |
| `BTW-FILING-10` | Tax inspector accept / dispute workflow | ✅ | ⚠️ **Splits** | Decision is made in the tax node; the shop has to learn the outcome over a wire that may be down for days. |
| `BTW-FILING-11` | Hash chain (tamper-evident, continues audit trail pattern) | ✅ | ⚠️ **Splits** | The chain starts shop-side and must verify tax-side. If the two ever disagree about what is hashed, the tamper-evidence is theatre. |
| `BTW-FILING-12` | Cross-org list for inspector + SA; own-org for OA; **own-store for SM** | ✅ | ⚠️ **Splits** | One query with three scopes becomes three queries in three nodes. The shop only ever has one org, so two of the three scopes vanish there. |
| `BTW-FILING-13` | Audit log entries for every transition (`btw.submitted/accepted/disputed`) | ✅ | ◆ All three | Each node logs the transitions it witnessed. Neither log is complete alone, and that is correct. |
| `BTW-FILING-14` | Resubmission via `superseded` status (recompute totals, audit-logged) | ✅ | ⚠️ **Splits** | Shop supersedes, tax must accept the supersession — and must not accept it twice. |
| `BTW-FILING-15a` | Tax Inspector dashboard — KPI landing | ✅ | 🏛 Tax | Inspector-facing. Moves whole. |
| `BTW-FILING-15b` | Submission detail view — per-store / per-source-POS / per-payment-method / per-rate | ✅ | 🏛 Tax | Reads only what the filing carried. Nothing extra needs to cross. |
| `BTW-FILING-15c` | Enhanced filters — org dropdown, source POS, search by reference | ✅ | 🏛 Tax | Inspector-facing. |
| `BTW-FILING-15d` | Click-row → detail and click-tile → filtered-list navigation | ✅ | 🏛 Tax | Inspector-facing. |
| `BTW-FILING-15e` | Source POS attribution (Josbin native vs Layer-3 third-party) | ✅ | ⚠️ **Splits** | Attribution is stamped at ingest — and by D5 third-party ingest happens in **control**, not in the shop. So control must stamp what tax displays. |
| `BTW-FILING-15` | Belastingdienst PDF export of accepted filings | 🔲 | 🏛 Tax | Unstarted. Do not lose it in the move — an inspector export is a statutory nicety, not a nice-to-have. |
| `BTW-FILING-16` | Late-filing oversight — cadence, overdue nudge, Remind, escalation | ✅ | ⚠️ **Splits** | The inspector sets cadence and escalates; the **shop** must be nudged. Needs a wire that currently does not exist between those two nodes. |
| `BTW-FILING-17` | Inspector **bulk-accept** (per-row authorised, partial-failure reporting) | ✅ | 🏛 Tax | Inspector-facing. |
| `BTW-FILING-18` | Expanded list filters — year, min/max amount, sort | ✅ | 🏛 Tax | Inspector-facing. |
| `BTW-FILING-19` | **CSV export** of the filtered submission list | ✅ | 🏛 Tax | Inspector-facing. |
| `BTW-FILING-20` | **Weekly** period type alongside daily / monthly | ✅ | ⚠️ **Splits** | A period vocabulary shared across a versioned wire. Adding a fourth period later means an N−2 migration on both sides. |
| `BTW-FILING-21` | **In-app notification bell** — filing, resubmit, dispute | ✅ | ⚠️ **Splits** | The events originate in one node and are read in another. Today it is one table. |
| `BTW-FILING-22` | Org filter populated for cross-org roles | ✅ | 🏛 Tax | Inspector-facing. |
| `BTW-FILING-23` | **Store Manager filing is store-scoped** | ✅ | 🏪 Shop | In a per-store node (D1) this stops being a scoping rule and becomes the only thing the node can do. |
| `BTW-FILING-24` | Official **Belastingdienst government portal** — gov-branded login, flag identity | ✅ | 🏛 Tax | Was catalogued as a second BTW-FILING-16; renumbered. Moves whole. |

### Authentication & session  ·  11 features

| ID | Feature | Now | Goes to | Note |
|---|---|---|---|---|
| `AUTH-01` | Password login + Sanctum token | ✅ | ⚠️ Splits | Three independent user tables, one per node. |
| `AUTH-02` | TOTP 2FA (Google Authenticator) | ✅ | ⚠️ Splits | Three independent user tables, one per node. |
| `AUTH-03` | Per-role 2FA policy (SA configures which roles must use 2FA) | ✅ | ⚠️ Splits | Three independent user tables, one per node. |
| `AUTH-04` | Recovery codes (8, single-use) | ✅ | ⚠️ Splits | Three independent user tables, one per node. |
| `AUTH-05` | Geo-alert for government login from outside Suriname | ✅ | ⚠️ Splits | Three independent user tables, one per node. |
| `AUTH-06` | Single-device enforcement for govt accounts | ✅ | ⚠️ Splits | Three independent user tables, one per node. |
| `AUTH-07` | Token rotation (/auth/refresh) | ✅ | ⚠️ Splits | Three independent user tables, one per node. |
| `AUTH-08` | Logout / logout-all-devices | ✅ | ⚠️ Splits | Three independent user tables, one per node. |
| `AUTH-09` | Rate limiting + progressive lockout | ✅ | ⚠️ Splits | Three independent user tables, one per node. |
| `AUTH-10` | Passkey login (WebAuthn) — register/list/remove in My Account, usernameless p… | ✅ | ⚠️ Splits | Three independent user tables, one per node. |
| `AUTH-11` | Forced re-login on role change | ✅ | ⚠️ Splits | Three independent user tables, one per node. |

### Organisation & user management  ·  17 features

| ID | Feature | Now | Goes to | Note |
|---|---|---|---|---|
| `ORG-01` | Create / edit / deactivate organisation | ✅ | ☁️ Control | The organisation record lives with the licence. |
| `ORG-02` | Stores screen — OA manages stores; Store Manager no longer sees the Stores me… | ✅ | ☁️ Control | The organisation record lives with the licence. |
| `ORG-03` | Create / edit / deactivate store (under org) | ✅ | ☁️ Control | The organisation record lives with the licence. |
| `ORG-04` | Licence-gated store creation (LICENSE_REQUIRED / EXPIRED / LIMIT_REACHED) | ✅ | ☁️ Control | The organisation record lives with the licence. |
| `ORG-05` | Per-store receipt template (logo + header + footer) | ✅ | ☁️ Control | The organisation record lives with the licence. |
| `USER-01` | Create / edit / deactivate user with role | ✅ | ⚠️ Splits | Shop owns its own users; Control owns ours. |
| `USER-02` | Strict 1:1 user-to-store pin (cashier + store_manager) | ✅ | ⚠️ Splits | Shop owns its own users; Control owns ours. |
| `USER-03` | Org-scoped roles ignore store_id | ✅ | ⚠️ Splits | Shop owns its own users; Control owns ours. |
| `USER-04` | Welcome email on user create | ✅ | ⚠️ Splits | Shop owns its own users; Control owns ours. |
| `USER-05` | Reset 2FA on a user | ✅ | ⚠️ Splits | Shop owns its own users; Control owns ours. |
| `USER-06` | View licence info on user row | ✅ | ⚠️ Splits | Shop owns its own users; Control owns ours. |
| `USER-07` | My Account — Profile + password (every role) | ✅ | ⚠️ Splits | Shop owns its own users; Control owns ours. |
| `USER-08` | My Account — Performance + Shifts tabs (ring-up roles only) | ✅ | ⚠️ Splits | Shop owns its own users; Control owns ours. |
| `USER-09` | My Account — Activity log (own logins, own audit trail) | ✅ | ⚠️ Splits | Shop owns its own users; Control owns ours. |
| `USER-10` | My Account — Active sessions + revoke (with audit log) | ✅ | ⚠️ Splits | Shop owns its own users; Control owns ours. |
| `CUST-01` | Customer detail view — profile + aggregates (spend / visits / last visit) + p… | ✅ | 🏪 Shop | WBP-S data. Never syncs upward. |
| `CUST-02` | Customer statement export — date range (default 90 d), PDF + CSV, netted tota… | ✅ | 🏪 Shop | WBP-S data. Never syncs upward. |

### Licence management  ·  10 features

| ID | Feature | Now | Goes to | Note |
|---|---|---|---|---|
| `LIC-01` | Issue licence (in-dashboard, Path B) | ✅ | ⚠️ Splits | Control ISSUES and signs; Shop VERIFIES offline. |
| `LIC-02` | List / edit / revoke licence | ✅ | ⚠️ Splits | Control ISSUES and signs; Shop VERIFIES offline. |
| `LIC-03` | Licence renewal request workflow | ✅ | ⚠️ Splits | Control ISSUES and signs; Shop VERIFIES offline. |
| `LIC-04` | Renewal status banners (warning_30 / 14 / grace / soft_lock / hard_lock) | ✅ | ⚠️ Splits | Control ISSUES and signs; Shop VERIFIES offline. |
| `LIC-05` | Hardware fingerprint binding (MAC + CPU + UUID) | 🟡 | ⚠️ Splits | Control ISSUES and signs; Shop VERIFIES offline. |
| `LIC-06` | Daily validation against licence server (24h + 72h offline grace) | 🔲 | ⚠️ Splits | Control ISSUES and signs; Shop VERIFIES offline. |
| `LIC-07` | Soft-lock blocks new sales | 🟡 | ⚠️ Splits | Control ISSUES and signs; Shop VERIFIES offline. |
| `LIC-08` | Hard-lock blocks login | 🔲 | ⚠️ Splits | Control ISSUES and signs; Shop VERIFIES offline. |
| `LIC-09` | Licence certificate generator (printable / email) | ✅ | ⚠️ Splits | Control ISSUES and signs; Shop VERIFIES offline. |
| `LIC-10` | Separate licence server app | 🔲 | ⚠️ Splits | Control ISSUES and signs; Shop VERIFIES offline. |

### Sync & offline (5-layer fallback)  ·  8 features

| ID | Feature | Now | Goes to | Note |
|---|---|---|---|---|
| `SYNC-01` | Layer 1 — Real-time sync (every sale → cloud within seconds) | 🟡 | ⚠️ Splits | It IS the wire: client in Shop, server in Control. |
| `SYNC-02` | Layer 2 — Auto retry (1m / 5m / 15m / 30m schedule) | 🟡 | ⚠️ Splits | It IS the wire: client in Shop, server in Control. |
| `SYNC-03` | Layer 3 — Z-Report forced retry / submit-to-HQ | ✅ | ⚠️ Splits | It IS the wire: client in Shop, server in Control. |
| `SYNC-04` | Layer 4 — USB encrypted export (.josbin_pos file, AES-256+HMAC) | ✅ | ⚠️ Splits | It IS the wire: client in Shop, server in Control. |
| `SYNC-05` | Layer 5 — Catch-up sync on internet restore | 🟡 | ⚠️ Splits | It IS the wire: client in Shop, server in Control. |
| `SYNC-06` | Mobile data dongle fallback (Digicel/Telesur 4G) | 🔲 | ⚠️ Splits | It IS the wire: client in Shop, server in Control. |
| `SYNC-07` | Offline sale buffering (POS keeps selling without internet) | ✅ | ⚠️ Splits | It IS the wire: client in Shop, server in Control. |
| `SYNC-08` | Yesterday-sync notice at the register gate — non-blocking "not at HQ yet" str… | ✅ | ⚠️ Splits | It IS the wire: client in Shop, server in Control. |

### Open Integration API (Layer 3)  ·  10 features

| ID | Feature | Now | Goes to | Note |
|---|---|---|---|---|
| `API-01` | API key issuance + rotation | ✅ | ☁️ Control | Third-party POS pushes here — see §21.4. |
| `API-02` | POST /v1/sales — single sale push | ✅ | ☁️ Control | Third-party POS pushes here — see §21.4. |
| `API-03` | POST /v1/sales/batch — batch upload (idempotent via external_sale_ref) | ✅ | ☁️ Control | Third-party POS pushes here — see §21.4. |
| `API-04` | GET /v1/reports/sales — third-party pulls own data | ✅ | ☁️ Control | Third-party POS pushes here — see §21.4. |
| `API-05` | Outbound webhooks (sale.created, shift.closed, refund.issued) | ✅ | ☁️ Control | Third-party POS pushes here — see §21.4. |
| `API-06` | HMAC webhook signing (X-JosbinPOS-Signature: sha256=…) | ✅ | ☁️ Control | Third-party POS pushes here — see §21.4. |
| `API-07` | Webhook secret rotation | ✅ | ☁️ Control | Third-party POS pushes here — see §21.4. |
| `API-08` | OpenAPI 3.0 spec auto-generated | ✅ | ☁️ Control | Third-party POS pushes here — see §21.4. |
| `API-09` | Per-API-key rate limiting (1000/min) | ✅ | ☁️ Control | Third-party POS pushes here — see §21.4. |
| `API-10` | Sandbox environment (separate stack, X-Josbin-Environment: sandbox) | ✅ | ☁️ Control | Third-party POS pushes here — see §21.4. |

### Audit & compliance  ·  9 features

| ID | Feature | Now | Goes to | Note |
|---|---|---|---|---|
| `AUD-01` | Append-only audit log (DB-level no-delete) | ✅ | ◆ All three | Each node keeps its own append-only log. |
| `AUD-02` | Audit log viewer (filters, search, JSON diff) | ✅ | ◆ All three | Each node keeps its own append-only log. |
| `AUD-03` | SHA-256 hash chain (tamper-evidence) | ✅ | ◆ All three | Each node keeps its own append-only log. |
| `AUD-04` | Successful-login audit events | ✅ | ◆ All three | Each node keeps its own append-only log. |
| `AUD-05` | Store-assignment change audit | ✅ | ◆ All three | Each node keeps its own append-only log. |
| `AUD-06` | Customer field-level encryption (WBP-S) | ✅ | ◆ All three | Each node keeps its own append-only log. |
| `AUD-07` | Customer search by HMAC-SHA256 (no partial search by design) | ✅ | ◆ All three | Each node keeps its own append-only log. |
| `AUD-08` | Rekenkamer audit export (full transaction trail, signed PDF) | ✅ | ◆ All three | Each node keeps its own append-only log. |
| `AUD-09` | Verwerkersovereenkomst PDF template (NL) | 🔲 | ◆ All three | Each node keeps its own append-only log. |

### AI Layer  ·  7 features

| ID | Feature | Now | Goes to | Note |
|---|---|---|---|---|
| `AI-01` | Smart product search (pgvector semantic) | 🟡 | ☁️ Control | Needs internet; cannot live in an offline node. |
| `AI-02` | Fraud anomaly detection (queued post-sale) | 🟡 | ☁️ Control | Needs internet; cannot live in an offline node. |
| `AI-03` | Weekly AI sales summary | 🔲 | ☁️ Control | Needs internet; cannot live in an offline node. |
| `AI-04` | Auto product categorisation + BTW suggestion on add | 🔲 | ☁️ Control | Needs internet; cannot live in an offline node. |
| `AI-05` | Natural-language reports (Phase 2) | 🔲 | ☁️ Control | Needs internet; cannot live in an offline node. |
| `AI-06` | Stock reorder prediction (Phase 2) | 🔲 | ☁️ Control | Needs internet; cannot live in an offline node. |
| `AI-07` | Invoice OCR (Phase 2) | 🔲 | ☁️ Control | Needs internet; cannot live in an offline node. |

---

### Cross-cutting  ·  13 features

No area owns these, which is exactly why a big move drops them: nothing fails
visibly when they go missing.

| Feature | Now | Goes to | Note |
|---|---|---|---|
| Dutch ↔ English UI parity | ✅ | ◆ All three | Three UIs now. A string added to one node is not added to the others. |
| SRD currency throughout | ✅ | ◆ All three | Lives in `domain/Money`. Written once, or receipts and filings drift by a cent. |
| AST timezone (America/Paramaribo) | ✅ | ◆ All three | Every date window in all three nodes. A UTC day boundary silently misfiles a day’s BTW. |
| BTW (discount-then-tax) order | ✅ | ◆ All three | `domain/Btw`, 56 tests, **one copy**. This is the single most important line in the split. |
| Tenant isolation (cross-org leak prevention) | ✅ | ⚠️ **Splits** | Inverts: a shop node has exactly one tenant, so today’s scoping is dead weight there and load-bearing in control and tax. Dead weight is dangerous — nobody tests it, and then a chain gets a second org. |
| Idempotency keys for external API | ✅ | ☁️ Control | Follows Layer 3 to control (D5). |
| Append-only audit log | ✅ | ◆ All three | Three chains. None of them is the whole story, and the Rekenkamer export must say so. |
| 5-layer offline fallback | ✅ | ⚠️ **Splits** | Client in the shop, server in control. It **is** the wire. |
| IonCube source protection | 🔲 | ◆ All three | Three encoded builds instead of one — and the shop build is the one that actually matters, because it is the only one on someone else’s disk. |
| Electron code signing (Windows) | 🔲 | 🏪 Shop | Only the shop ships a desktop binary. |
| OWASP Top 10 audit | 🔲 | ◆ All three | Three attack surfaces to audit, not one. Scope and cost triple; say so before quoting. |
| WBP-S compliance certification | 🔲 | ◆ All three | And D3 adds a processor relationship that does not exist today. The documentation is not a copy-paste across three nodes. |
| Report-endpoint caching (`ReportCache`) | ✅ | ⚠️ **Splits** | Cache keys are scoped platform / org / org+store. The platform scope has no meaning in a shop node — a key that quietly collides is a manager reading another store’s numbers. |

---

## 21.4 What must be BUILT — the split is not done without these

None of this exists today. The migration is incomplete until it does.

| # | To build | Why | Node |
|---|---|---|---|
| N1 | Licence **signing** — keypair, token minting, revocation list | Replaces the always-online check | ☁️ Control |
| N2 | Licence **offline verification** — public key baked in, signature + expiry on boot | The security of the whole model | 🏪 Shop |
| N3 | Hardware fingerprint capture and binding | Stops VM cloning | 🏪 Shop |
| N4 | Monotonic server-time record | Stops clock-winding to dodge expiry | 🏪 Shop |
| N5 | **Activation flow** — key → verify → bootstrap first admin | No central user directory needed | Both |
| N6 | Read-only degrade instead of hard lock | D2: never lock a paying customer out | 🏪 Shop |
| N7 | Rollup sync — build, queue, retry, version stamp | Feeds the whole control dashboard | 🏪 Shop |
| N8 | Rollup ingest, accepting N−2 payload versions | Fleet spans versions permanently | ☁️ Control |
| N9 | Nightly encrypted archive + upload when online | The DR story in D6 | 🏪 Shop |
| N10 | Archive key escrow, stored apart from archives, every use logged | Makes the DPA claim true | ☁️ Control |
| N11 | Node health register — version, last seen, licence state | You cannot support a fleet you cannot see | ☁️ Control |
| N12 | Shop-side **filing signature** | D4: provably theirs, unaltered | 🏪 Shop |
| N13 | Filing receipt store — reference and timestamp, no amounts | D4: stay out of the chain of custody | ☁️ Control |
| N14 | Node profile switch — routes, migrations, modules per node | Makes three builds from one repo | All |
| N15 | Three build targets + artifact check that Shop carries no Control code | Step 6's gate in chapter 20 | Build |
| N16 | A test path that actually runs | See §21.6 — the gate depends on it | Build |

## 21.5 What we deliberately skip

- **Collapsing `organisation_id` / `store_id`.** D1. The reward is tidiness; the
  cost is the freeze list.
- **Database-per-organisation.** D6. Right answer to the old question, wrong
  answer to this one.
- **Layer 3 pushing *into* a shop's catalogue or stock.** Only reporting sales in
  is supported. Revisit when someone actually asks.
- **A dashboard dark theme.** Unrelated to the split and the dark palette failed
  validation. Not in this work.
- **Re-touching the BTW engine, receipt bytes, money precision, AST handling or
  the audit log's immutability.** Chapter 20 §20.7. They move; they do not change.

## 21.6 Known blocker before step 1

Chapter 20's gate on step 1 is *"full suite green, no test edited"*. **There is
currently nowhere that can be proven.** The suite does not boot locally — the
harness config points the database host at the container name, and the
development-only debug provider fails outside the app environment — and the
production container has no test runner, because production installs strip
development dependencies.

Fix that first (N16). A refactor whose only safety net is a test run nobody can
perform is not a safe refactor.
