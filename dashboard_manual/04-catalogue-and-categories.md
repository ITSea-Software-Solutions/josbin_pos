# Chapter 4 — Product Catalogue & Categories

**Who needs this:** Organisation Admin (the catalogue owner) and Store Manager (limited editor).

The catalogue is the heart of the system — it's what cashiers tap to ring up a sale. Get it right once at HQ, and every till at every branch follows along instantly.

This chapter covers the single-product workflow (add, edit, deactivate, scan a barcode), the category structure (what comes pre-seeded, how to add your own), and the BTW-exempt flag — which has direct legal implications under Surinamese tax law.

For *bulk* loading via CSV or Excel, see Chapter 5.
For *per-store price overrides* (e.g. Nickerie sells the same can of corned beef at SRD 14.50 instead of 13.00), see Chapter 6.

---

## 4.1 How the catalogue is organised

The model is deliberately simple:

```
ORGANISATION (e.g. Supermarkt De Hoop NV)
   │
   ├── master product catalogue (one master list, shared by all stores)
   │     │
   │     ├── product: "Volle Melk 1L"  →  Category: Zuivel,  Price: SRD 12.50,  BTW: 10 %
   │     ├── product: "Brood Wit"      →  Category: Brood,   Price: SRD  6.00,  BTW: exempt
   │     └── product: "Cola 1.5L"      →  Category: Frisdrank, Price: SRD 18.00, BTW: 10 %
   │
   └── stores
         ├── De Hoop — Paramaribo Centrum  (sees the master catalogue at master prices)
         └── De Hoop — Nieuw Nickerie      (sees the master catalogue, optionally with price overrides)
```

Key implications:

- **One catalogue per organisation.** Add a product once; all branches in that org see it.
- **Per-store price overrides** are an opt-in adjustment, not a separate product. The product name, barcode, BTW rate and category are always set at the org level; only the price (and stock count) can vary per store. See Chapter 6.
- **Stock is per-store.** Adding a product gives it an initial `stock_qty` at the catalogue level for convenience, but each store tracks its own physical count from then on (Chapter 8).

> **Cashiers cannot edit products.** The POS app only *sells* products; it cannot create or change them. This is a deliberate guard against till-side fraud (e.g. a cashier creating a fake low-price product to ring up for a friend).

---

## 4.2 Adding a single product

**Path:** Dashboard → **Catalogus / Catalogue** (left sidebar) → **Producten / Products** tab is selected by default → **+ Product toevoegen / + Add product** (top-right button).

> Super Admin only: pick the organisation from the **Organisatie / Organisation** selector at the top of the page first. Org Admin and Store Manager are automatically scoped to their own organisation — the selector doesn't appear.

The Add Product modal opens. Fields:

| Field | Required | Notes |
|---|:-:|---|
| **Naam (NL) / Name (NL)** | ✅ | Dutch name. Shown on receipts and POS grid when the cashier's language is Dutch. e.g. `Volle Melk 1L`. |
| **Naam (EN) / Name (EN)** | ✅ | English name. Shown when the language is English. Can be identical to NL if there's no good translation. |
| **Categorie / Category** | optional | Pick from the dropdown. Determines which colour-coded filter button the product sits under in the POS grid. |
| **Barcode** | optional | EAN-13, Code 128, EAN-8, UPC-A. Type it, or tap the small scanner icon next to the field to scan with the device camera. |
| **Prijs (SRD) / Price (SRD)** | ✅ | Decimal, 2 places — e.g. `12.50`. This is what the cashier rings up by default; per-store overrides (Ch.6) can deviate. |
| **BTW %** | ✅ | `10 %` (current Suriname VAT) or `0 %`. Defaults to `10`. |
| **BTW-vrijgesteld / BTW exempt** | optional toggle | Basic foodstuffs and medicine — see §4.7 below. When ticked, the BTW % field is bypassed entirely. |
| **Voorraad / Stock** | optional | Starting stock count. Defaults to `0`. Per-store stock is tracked separately from then on. |

Tap **Opslaan / Save**. The product appears in the products table immediately and is pushed to every connected POS terminal in this organisation via WebSocket — usually visible at the till within a couple of seconds.

### Scanning a barcode with the camera

The small barcode-icon button next to the **Barcode** field opens a camera scanner overlay. It uses the same Quagga2 library as the POS app:

1. Tap the icon. Browser asks for camera permission — accept.
2. Point the camera at the EAN-13 / Code 128 / UPC-A / EAN-8 barcode on the product packaging.
3. When a code is detected, the field shows it in green, plus a green "Gebruiken / Use this" button.
4. Tap **Gebruiken / Use this**. The barcode is dropped into the field; the scanner closes.

For workflows where you're adding many products with a USB barcode scanner (common in stock-room setups), just put focus into the Barcode field and pull the trigger — USB barcode scanners type characters then press Enter, so they work without needing the camera modal at all.

> **Unique barcodes are not enforced** between products in this release. If you accidentally assign the same EAN-13 to two products, the cashier scanning it will see the *first* match — which is usually not what you want. Always double-check uniqueness when adding multiple variants of the same item.

---

## 4.3 Editing a product

**Path:** Catalogue → Products tab → find the row → tap **Bewerken / Edit**.

Same modal as Add Product, with everything pre-filled. You can change any field including the BTW rate, the BTW-exempt flag, the category, the price, the stock. Tap **Opslaan / Save**.

Changes propagate to every connected POS terminal in the organisation within seconds via the WebSocket push. Cashiers who happen to be on the product grid will see the new price update live.

The Edit modal also exposes an **Actief / Active** toggle (it doesn't show in the Add form — new products are always created active). Toggling it off here is the same as the row-level deactivate button described below.

> **One subtle behaviour:** if you edit a product's price *while a cashier has it sitting in a half-finished cart*, the cart keeps the price it was added at. The new price only applies to the *next* time the cashier adds the product. This avoids surprising the customer with a price change mid-sale.

---

## 4.4 Deleting (deactivating) a product

The dashboard exposes **Deactiveren / Deactivate** rather than hard delete. Permanent deletion of a product that has ever been sold would break BTW reports and the Rekenkamer audit trail. Deactivation gets you the same practical result without that risk.

**To deactivate a product:**

1. Catalogue → Products tab → find the row.
2. Tap the red **Deact.** button.
3. Confirm the prompt.

The status badge flips to grey *Inactief / Inactive*. The product disappears from the POS grid on every terminal within seconds. Historical sales are untouched — every receipt that ever included this product still shows it.

**Reactivating** is the same button, now green and labelled **Act.**

Role-wise (per Chapter 1's permission matrix):
- **Super Admin** and **Organisation Admin** can deactivate/reactivate.
- **Store Manager** can edit individual products (fix typos, adjust prices) but *cannot* deactivate — that's an HQ decision because it affects every branch at once.

> **Permanent hard-delete** of a product that has never been sold is technically possible via API for vendor support, but is not exposed in the dashboard UI. If a client really needs a product gone (e.g. a duplicate entry created in error), Org Admin deactivates it and leaves it — it doesn't hurt anything.

---

## 4.5 Managing categories

Categories are the colour-coded buttons across the top of the POS product grid. A good category structure makes the till faster — a bad one makes cashiers hunt.

**Path:** Catalogue → **Categorieën / Categories** tab.

### What comes pre-seeded

When you create a new organisation, Josbin POS automatically seeds **41 default categories** aimed at a Suriname supermarket / convenience store. They're grouped roughly by where things sit on the shop floor:

| Section | Categories |
|---|---|
| **Fresh food** | Brood (Bread), Bakkerij (Bakery), Zuivel (Dairy), Vlees (Meat), Vis (Fish), Kip (Poultry), Groenten (Vegetables), Fruit (Fruit), Diepvries (Frozen) |
| **Dry pantry** | Droog (Dry Goods), Rijst & Pasta, Granen (Cereals), Sauzen (Sauces), Kruiden (Herbs & Spices), Conserven (Canned Goods) |
| **Beverages** | Dranken (Beverages), Frisdrank (Soft Drinks), Sap (Juice), Water, Koffie & Thee, Bier, Wijn & Sterk (Wine & Spirits) |
| **Snacks & treats** | Snacks, Snoep (Candy), Chips, IJs (Ice Cream) |
| **Regulated** | Tabak (Tobacco) |
| **Household** | Huishoud (Household), Schoonmaak (Cleaning), Wasmiddel (Laundry), Papierwaren (Paper Goods) |
| **Personal care** | Hygiëne, Cosmetica, Verzorging (Personal Care), Gezondheid (Health) |
| **Family** | Baby, Huisdier (Pet) |
| **Misc** | School & Kantoor, Hardware, Elektronica, Cadeau (Gift), Overig (Other) |

Each comes with a Dutch name, an English name, an emoji icon and a colour — all visible at a glance to the cashier.

> **You can ignore, hide, rename or extend any of them.** The seeder is just a sensible starter pack so a new org isn't staring at an empty grid on day one.

### Adding a new category

1. Catalogue → Categories tab → **+ Categorie toevoegen / + Add category**.
2. Fill in:
   - **Naam (NL) / Name (NL)** — e.g. `Surinaamse Specialiteiten`
   - **Naam (EN) / Name (EN)** — e.g. `Surinamese Specialties`
   - **Sorteervolgorde / Sort order** — a number (lower = appears earlier in the POS grid). Default `0` puts it at the very front. Use `10`, `20`, `30`… spacing to leave room for inserting between later.
3. Tap **Opslaan / Save**.

> **Icon and colour:** seeded categories have an emoji icon and a brand colour. The dashboard form does not currently expose icon/colour editors when you *create* a new category — new ones get a default placeholder. If you need custom icons on your custom categories, that's a vendor support request.

### Editing a category

Categories tab → **Bewerken / Edit** button on the row. Same fields as the add modal, plus an **Actief / Active** toggle.

Renaming a category is safe — every product that pointed at it still points at it. The new name appears on the POS grid immediately.

### Reordering / deactivating categories

To **reorder**: edit the category and change its *Sorteervolgorde / Sort order*. Lower numbers come first. The POS grid re-flows on the next refresh.

To **deactivate** (hide from POS): tap the red **Deact.** button on the row. Cashiers no longer see the category button. Products assigned to that category remain in the system but appear under *No category* in the cashier's all-products view.

To **permanently delete**: not exposed in the UI. Deactivate is the right call for the same reasons as products (§4.4).

---

## 4.6 What cashiers actually see in the POS

The POS product grid is driven by your catalogue choices in two ways:

- The **category filter bar** at the top of the grid mirrors your active categories, in the order you set with `sort_order`. Tapping a category filters the grid to products in that category.
- The **product tiles** show whatever `name_nl` or `name_en` you typed, plus the price in SRD. The cashier can configure their grid to display by name only, photo only, or both — that's a per-terminal setting (covered in the POS User Manual).

Deactivated products and categories disappear from the cashier's view within seconds of the dashboard change. There's no "publish" step — every save is live.

> **The cashier's view follows the cashier's language.** If they have their UI set to Dutch, they see `name_nl`. If English, `name_en`. Filling in *both* fields is therefore worth the extra five seconds per product.

---

## 4.7 The BTW-exempt flag — when to use it

Suriname BTW (currently 10 %) is **not charged** on certain goods, including:

- Basic foodstuffs (`brood`, basic rice, basic flour, raw fruit and vegetables, fresh meat, milk for kids)
- Medicine and pharmaceuticals
- A handful of other categories defined by Belastingdienst Suriname

When you tick **BTW-vrijgesteld / BTW exempt** on a product, three things happen:

1. The BTW % field is bypassed — the system stores `btw_rate = 0` regardless of what was set.
2. The product line on every receipt shows **Vrijgesteld / Exempt** instead of a 10 % BTW figure.
3. The daily BTW report (Chapter 10) tallies these sales under a separate "exempt" line so Belastingdienst filings stay clean.

> **Not sure if something is exempt?** Don't guess. The official list is published by Belastingdienst Suriname and updated periodically — when in doubt, charge BTW (10 %) and let the customer claim back if they have a basis for it. The opposite (skipping BTW on something taxable) creates a compliance problem for the client.

The Products table flags exempt products with a green pill in the BTW column for quick visual scanning.

---

## 4.8 Push catalogue — instant refresh of every POS terminal

After a bulk price change, a flurry of edits, or a CSV import — when you need every till to see the new catalogue *now* instead of waiting for the next natural refetch:

**Path:** Catalogue → header → **📡 Push naar alle kassa's / Push to all tills**.

What happens:

1. Backend broadcasts a `catalogue.refresh` event on the org's Reverb WebSocket channel.
2. Every POS terminal in the org receives the event, invalidates its cached `pos-products` query, and refetches `/api/products/pos`.
3. Updated prices / new products / removed items appear on screen within seconds.

Button states:
- **📡 Push to all tills** (idle)
- **… Pushing** (in flight)
- **✓ Sent** (green flash for 3 seconds)
- **✗ Failed** (red flash; check Horizon for the Reverb job error)

Permission: granted to `store_manager`, `organisation_admin`, and `super_admin` via the `products.create` capability. Cashiers don't see the button.

> When *not* to push: small tweaks (one price change, one new product) — terminals already refetch every few minutes via TanStack Query's stale-time. The push is for the cases where waiting that long isn't acceptable.

---

## 4.9 Bulk import — cross-reference

For loading hundreds or thousands of products at once (a typical store opening or annual price refresh):

- CSV upload with a downloadable template
- Idempotent upsert (existing barcodes get updated, not duplicated)
- Validation report showing created / updated / skipped / errors

This is covered in **Chapter 5 — Bulk Import (CSV / Excel)** *(coming soon)*. The hooks are in this release — the Catalogue Import / Export screen is in the sidebar under **Import / Export**, accessible to Super Admin and Org Admin only.

---

## 4.10 AI auto-categorisation

Planned feature: when adding a new product, an AI helper would propose a likely category based on the product name (and barcode lookup against a database of common Suriname SKUs).

As of this release, **the dashboard product-create form does not include a "Suggest category" button.** The AI features that *are* live (smart product search at the POS, weekly sales summary, anomaly detection) are accessible from the AI Insights screen and are covered in Chapter 14. Auto-categorisation on product create is on the Phase 2 roadmap; this section will be updated when it ships.

If you want a starting category for a fresh import, the cleanest current approach is:
- Leave the **Categorie / Category** field blank when adding the product.
- Run a quick filter later: Catalogue → Products → filter `Alle categorieën / All categories` → review the no-category items in batch and assign.

---

## 4.11 Quick reference

```
ADD PRODUCT          Catalogue → Products → + Add product → fill form → Save
EDIT PRODUCT         Catalogue → Products → Edit on row → change → Save
DEACTIVATE PRODUCT   Catalogue → Products → Deact. on row → confirm
SCAN BARCODE         Inside Add/Edit Product → tap scanner icon → point at barcode → Use this

ADD CATEGORY         Catalogue → Categories tab → + Add category → fill form → Save
EDIT CATEGORY        Catalogue → Categories → Edit on row → change → Save
REORDER CATEGORIES   Edit each → adjust Sort order (lower = earlier)
DEACTIVATE CATEGORY  Catalogue → Categories → Deact. on row → confirm

PUSH TO ALL TILLS    Organisations list → Push catalogue button on org row
                     (auto-pushes happen on every save; this button forces a re-push)
```

Stuck? Check Chapter 1 for what each role can touch, Chapter 6 for per-store price overrides, Chapter 8 for stock management.

---

→ Next: Chapter 5 — Bulk Import (CSV / Excel) *(coming soon)*
