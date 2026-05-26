# Chapter 8 — Stock Management

**Who needs this:** Store Manager (daily — receive deliveries, write off breakage, watch low-stock alerts) and Organisation Admin (cross-store reviews, opening-stock loads when a new branch comes online).
**When you use it:** every time stock physically changes hands and the system didn't already know — invoices come in, a box gets dropped, someone finds expired meat, a stocktake disagrees with the screen.
**What it prevents:** silent over-selling, ghost shrinkage, BTW reports that don't match physical reality, and managers learning about an empty shelf from a complaining customer.

The Stock screen is the only place in the dashboard where you can **manually move the number on the shelf**. Everything else (a sale, a void, a refund) moves stock automatically as a side effect — you don't have to do anything for those.

> _Screenshot placeholder: `dashboard_manual/screenshots/08-stock-screen.png`_

---

## 8.1 The model — how Josbin POS tracks stock

Stock is **per (product, store)**. There is no single `stock_qty` column on a product that "the whole organisation" shares — each branch keeps its own count.

```
ORGANISATION (e.g. Supermarkt De Hoop NV)
   │
   ├── master product: "Volle Melk 1L"
   │     │
   │     ├── ProductStock(store: Paramaribo Centrum)  →  qty 24, threshold 6
   │     ├── ProductStock(store: Nieuw Nickerie)      →  qty  3, threshold 6  ← LOW
   │     └── ProductStock(store: Marowijne)           →  qty  0, threshold 6  ← OUT
   │
   └── stock_movements (append-only ledger — every change, forever)
         │
         ├── 2026-05-26 09:14  sale          −1   qty_after 24   by cashier Sharmila
         ├── 2026-05-26 11:02  adjustment    +50  qty_after 74   by manager Rashied  (note: "factuur 2026-05-26")
         ├── 2026-05-26 15:48  void          +1   qty_after 75   by cashier Sharmila
         └── …
```

Two tables matter:

| Table | Purpose | Mutability |
|---|---|---|
| `product_stocks` | The *current* number on the shelf, per (product, store). Updated atomically with every movement. | Updated, never deleted |
| `stock_movements` | The *ledger* — every change to that number, with the actor, reason, optional note, and a `qty_after` snapshot. | Append-only (`updating`/`deleting` blocked in code) |

Every change runs through `StockMovementService::record()`, which locks the matching `product_stocks` row, applies the delta, and writes the ledger row inside one DB transaction. That guarantees:

- Two cashiers ringing up the **last can of corned beef** at the same till station can't both succeed — the row lock serialises them.
- Sales at **different stores** for the same product don't block each other — different `product_stocks` row.
- You cannot rewrite history. There is no "edit this movement" button anywhere, and the API doesn't have one either.

> **Stock can never go negative.** The service clamps the resulting quantity at zero. If you write off 100 from a shelf that only has 80, the new value is `0`, not `-20`. The movement still records `qty_change = -100` honestly, so a later stocktake reads "we wrote off more than was there — investigate".

### Where the initial number comes from

When you add a store to an organisation that already has a populated catalogue, no manual seeding is required. The first time anything happens to a (product, store) pair at the new branch, the system creates the `product_stocks` row using the master product's `stock_qty` as the starting value, marks it with reason `initial`, and goes from there. No ghost rows, no NULL counts — but no inflated "every branch magically has the same opening stock" either, because the row only materialises when needed.

---

## 8.2 Getting to the Stock screen

**Path:** Dashboard left sidebar → **Voorraad / Stock**.

You land on the **All products** tab. The screen has two tabs:

| Tab | Shows | When to use |
|---|---|---|
| **Alle producten / All products** | Every active product, with current stock + threshold. Searchable by name or barcode. Paginated 30 per page. | Routine reviews, finding a specific product to adjust. |
| **Lage voorraad / Low stock (N)** | Only products at or below their `low_stock_threshold` (or at zero). No pagination — capped at 50. | Your morning sweep, refill planning, the screen you open when the dashboard overview tile says "12 low / 3 out". |

A **yellow banner** sits across the top of the All-products tab whenever the low-stock list is non-empty — even if you're not on that tab. It includes a "Review now" button that jumps you to the Low-stock tab.

> **Where the alert tile fits in.** The dashboard home (Chapter 0) renders a green tile when everything is fine and a yellow tile when at least one product is low or out. Clicking it deep-links to the Low-stock tab. The number on the home tile and the number in the tab header come from the same query — they always agree.

---

## 8.3 Reading a row

> _Screenshot placeholder: `dashboard_manual/screenshots/08-stock-row-badges.png`_

Each row in the table tells you four things at a glance:

| Element | Meaning |
|---|---|
| **Product name** (NL or EN depending on your locale) | Click-target for the action buttons. Barcode shown underneath in monospace. |
| **Category** | Dutch name when your locale is `nl`, English when `en`. `—` if no category. |
| **Voorraad / Stock** | Current quantity. Coloured green (healthy), amber (low), or red (out). Trailing zeros stripped — you see `12`, not `12.000`. |
| **Min. drempel / Min. threshold** | The `low_stock_threshold` for this product at this store. `—` if not set. |

And two **badges** when relevant:

| Badge | Colour | Trigger | What it means |
|---|---|---|---|
| **LOW** | Amber `#f59e0b` | `0 < stock_qty ≤ low_stock_threshold` and `threshold > 0` | Restock soon. Sales still go through. |
| **OUT** | Red `#dc2626` | `stock_qty ≤ 0` | Cashiers see an inline warning in the POS; sales still possible (Josbin POS doesn't hard-block over-selling — you can sell from a backstock you forgot to receive). |

The whole row also gets a pastel red/amber background so you can scan a busy page without reading numbers. **OUT wins over LOW** — a zero-stock row is never painted yellow, only red.

> **The threshold is a *per-store* setting**, not a master-catalogue setting, even though it's shown in the table next to the product name. Two branches of the same chain can run different thresholds for "Brood Wit" depending on bake-day cadence. The default when a new store gets a row is the master product's `low_stock_threshold` (which is `0` if you never set one — meaning "no alert" for that product).

---

## 8.4 Adjusting stock — the everyday workflow

Use this when stock physically moved and the system doesn't already know — receiving a delivery, writing off breakage / expiry / theft, fixing a count after a stocktake, or loading opening stock when a new branch goes live.

**Path:** Stock screen → find the product (search by name or barcode) → tap **+ Aanpassen / + Adjust**.

> _Screenshot placeholder: `dashboard_manual/screenshots/08-adjust-modal.png`_

The Adjust modal opens. Fill in:

| Field | Required | Notes |
|---|:-:|---|
| **Aanpassing / Adjustment** | ✅ | Signed number. Positive = receive (`+50`). Negative = write-off (`-5`). Zero is rejected — there's no point recording a no-op. |
| **Reden / Reason** | ✅ | Pick one of three. See the table below. |
| **Notitie / Notes** | optional but expected for write-offs | Free text up to 500 chars. Visible to every later viewer of the movement history and to the auditor. e.g. `factuur 2026-04-28`, `expired stock — 3 yoghurts`, `stocktake — count 47, system 50`. |

The modal previews **Nieuwe voorraad / New stock** as you type so you can sanity-check the maths. If the result is negative, the preview turns red — but that's only a warning. The save will still go through, and the saved quantity will be clamped to `0` server-side.

### The three reasons you can pick

| Reason value | Dutch label | English label | When to pick it |
|---|---|---|---|
| `import` | *Levering ontvangen* | *Stock received* | A box just arrived from your supplier. Always positive. Notes field should reference the invoice number. |
| `adjustment` | *Correctie* | *Correction / write-off* | Anything else — expired, broken, stolen, miscounted, found in the backroom, donated. Positive **or** negative. Notes field is strongly recommended. |
| `initial` | *Beginsaldo* | *Opening stock* | First-time loading at a new branch, or a one-off rebase after a full physical stocktake at year-end. |

> **There is no `sale` / `void` / `refund` option in the dropdown.** Those reasons exist in the ledger but are written only by the system itself when a sale happens — you can't fake one from this screen.

When you tap **Opslaan / Save**, three things happen atomically:

1. The `product_stocks` row for this (product, current store) gets the new quantity.
2. A `stock_movements` row is written with your user ID, the reason, the optional note, and a snapshot of the resulting quantity.
3. The Stock screen, the Low-stock list, the dashboard overview tile, and the movement-history modal all refresh.

> **Per-store gotcha.** The Stock screen as currently shipped works against the active store context for managers and against an org-wide aggregate for Org Admin. When the underlying API does the adjustment it requires an explicit `store_id`. If you manage multiple stores and need to receive stock at a *specific* branch, switch your store context first (top-right store picker) — otherwise the adjustment lands at the wrong shelf.

### Receiving a delivery — the right pattern

1. The truck arrives. Count the cartons against the supplier's pack-list as they come off.
2. For each line item that matches the pack-list:
   - Search the product on the Stock screen by barcode (USB scanner: just focus the search box and pull the trigger).
   - Tap **+ Aanpassen / + Adjust**.
   - Adjustment: `+<qty>` (positive).
   - Reason: `Levering ontvangen / Stock received`.
   - Notes: the invoice or pack-list reference, e.g. `factuur LIDL-2026-04-28`.
   - Save.
3. Discrepancies (5 expected, 4 in box) — receive what's actually there, then file a credit-note request with the supplier. Don't pretend you received 5 because the paperwork said so. The audit log catches the lie six weeks later when somebody runs a stocktake.

### Writing off — the right pattern

1. Take the spoiled / broken / expired stock to one side.
2. On the Stock screen, find each item.
3. Adjustment: `-<qty>` (negative). Reason: `Correctie / Write-off`. Notes: a specific reason — *not* just "shrinkage".
4. Save.
5. Physically dispose of the stock so it can't accidentally re-enter the shelf.

> **Why the notes matter.** "Adjustment: −12" with no note is unanswerable in a quarterly review. "Adjustment: −12 — expired strawberry yoghurts, batch L-44, found at 09:00 stocktake" is auditable. Aim for the second.

---

## 8.5 Viewing movement history

Every product carries a full ledger of every stock change since the row was first created. To read it: Stock screen → row → **Historie / History** button.

> _Screenshot placeholder: `dashboard_manual/screenshots/08-history-modal.png`_

The modal lists the most recent 50 movements newest-first:

| Column | Shows |
|---|---|
| **Datum / Date** | Localised short date (NL: `26 mei`; EN: `May 26`). Time is *not* shown — open the audit log (Chapter 13) for second-precision timestamps. |
| **Reden / Reason** | One of six values, see table below. Notes (if any) appear on a second line in grey. |
| **Wijziging / Change** | The delta. Green if positive, red if negative, with a leading `+` for clarity. |
| **Voorraad / Stock** | `qty_after` — the running total **after** this movement was applied. Lets you reconstruct the shelf state at any point in the past without subtracting your way down the list. |
| **Door / By** | The user who triggered the change. `—` (system) for automatic catch-up jobs (rare). |

### The six reason values

| Reason | Origin | Sign | Meaning |
|---|---|---|---|
| `sale` | POS — a sale completed | Negative | A cashier rang the product up at the till. |
| `void` | POS — a held bill cancelled or a sale voided pre-print | Positive | The reservation was returned to the shelf. |
| `refund` | Manager — refund issued via the POS | Positive | The customer brought goods back; stock restored. |
| `adjustment` | Dashboard — manager adjustment via this screen | Either | Catch-all for write-offs, corrections, finds. |
| `import` | Dashboard — "Stock received" from this screen, or CSV import (Chapter 5) | Positive | Delivery arrived. |
| `initial` | Dashboard — opening stock at a new branch | Positive | First time the system ever saw stock for this (product, store). |

> **Why no "edit" button on history rows?** Because the table doesn't allow it — `static::updating(fn () => false)` on the `StockMovement` model. If you wrote down the wrong number, your only recourse is to *create a corrective movement* that explains the mistake. Both the original and the correction stay forever. This is what an auditor wants to see.

---

## 8.6 Setting and tuning the low-stock threshold

The `low_stock_threshold` for a product at a specific store determines when the amber LOW badge appears.

| Where you set it | Path | Scope |
|---|---|---|
| Master default (applied to new stores) | Catalogue → Products → Edit a product → field `low_stock_threshold` | Org-wide default — only used to seed *new* (product, store) rows. |
| Per-store override | *(not currently exposed in the dashboard UI as a standalone editor)* — set indirectly via the catalogue defaults plus the per-store row that materialises on first activity. | Per (product, store). |

In the current release, the practical rule is:

1. Set sensible org-wide defaults in the catalogue: bread = 5, milk = 6, cigarettes = 2, whatever fits your weekly velocity.
2. When a new store opens, those defaults are inherited the first time any movement touches the product at that store.
3. If a specific branch genuinely needs a different threshold (e.g. Nickerie sees a slower bread turnover than Centrum), that's a vendor-side adjustment for now — a UI editor for per-store thresholds is on the backlog.

**A threshold of `0` (the default if you never set one) disables the LOW badge entirely** for that product, even when stock is genuinely low. Out-of-stock (`qty_qty ≤ 0`) is *always* flagged regardless of threshold — it's a separate check.

> **Don't set the threshold too low.** "Threshold = 1" means you only see the alert when there is exactly one left on the shelf — by the time you act, you're already out. Aim for "enough to last one delivery cycle". For a weekly bread delivery, that's a week's worth of sales.

---

## 8.7 The dashboard overview tile — your morning glance

> _Screenshot placeholder: `dashboard_manual/screenshots/08-overview-tile.png`_

On the dashboard home, just below the four KPI cards, sits the **Stock alerts** tile. It has two states:

| State | When | Colour | Behaviour |
|---|---|---|---|
| **All good** | No products low, no products out | Green — `✓ Geen waarschuwingen / No alerts` | Reassuring, not clickable. |
| **Has alerts** | At least one low or out | Yellow with a red badge for OUT count | Whole tile is clickable + keyboard-navigable; click jumps to Stock → Low-stock tab. |

The tile refreshes every 2 minutes in the background, so an adjustment you make on the Stock screen will reflect on the home tile by the time you navigate back.

> **Where the count comes from.** The tile asks the products endpoint for `low_stock=true` (capped at 200 rows for payload size) and counts client-side: `out` is `stock_qty ≤ 0`, `low` is `0 < stock_qty ≤ threshold`. The pagination `total` is the authoritative combined figure shown in the badge.

---

## 8.8 The POS side of low stock

Although this manual is for the dashboard, it's worth knowing what cashiers see, so you can answer their questions.

On the POS app, every product card and every cart line item displays a tiny **yellow inline warning** when the product is in the low-stock set for the current store. The check is driven by `useLowStockSet()` on the frontend — a separate query against the same `low_stock=true` filter, scoped to the cashier's store, cached for 5 minutes.

Cashiers can still ring the product up — Josbin POS never blocks a sale on a stock count because the count might be wrong. The warning is a "tell the manager when you get a chance" signal, not an over-sell prevention. Out-of-stock products show a sharper red warning on the cart line too.

> **Why no hard block?** Because customer satisfaction beats data hygiene at the till. If the system says "0 left" but there's a forgotten box under the counter, the cashier should be able to sell it and let the back office reconcile later. The audit trail (and the next stocktake) catches the discrepancy.

---

## 8.9 Common mistakes / gotchas

**Adjusting at the wrong store.** Stock is per-(product, store). If you're an Org Admin reviewing low stock across all branches, an adjustment lands at the store currently in context — not at every branch. Always double-check the store picker before tapping Save. If you receive a delivery at HQ that gets distributed to two branches, you need *two* adjustments — one at each store — not one big one.

**Using the wrong reason.** "Adjustment: +50, reason: Stock received" reads to the auditor as "this is a delivery". Using `adjustment` (correction) for a real delivery hides the supplier paperwork link. Pick `import` when an invoice exists; use `adjustment` only for write-offs, corrections, and finds.

**Forgetting the note on a write-off.** Twelve weeks later, no one — including you — will remember why "Brie 200g" dropped by 8 on a Tuesday morning. The audit log will faithfully record "manager X reduced stock by 8 at 09:14, no note". That's an audit smell.

**Thinking deactivating a product clears the stock.** Deactivating a product (Chapter 4) hides it from the POS grid. It does **not** zero out `product_stocks` rows or stop you from running stocktakes against it. If you genuinely want to retire a product that has remaining stock, write the stock off first (`adjustment` with a note like `"removed from sale — old packaging"`) and then deactivate.

**Two cashiers selling "the last one" at the same till.** This *cannot* result in over-selling at one register — the row lock on `product_stocks` serialises the two transactions. The second one sees `qty_after = 0` and would, if you'd enabled hard-blocking, fail. Currently it succeeds and the value clamps to `0` — at worst you have one negative-shaped audit trail to reconcile, never two phantom sales.

**Stock going to zero but no alert.** If `low_stock_threshold = 0` (the default) and stock hits zero, you'll still see the **OUT** red badge — out-of-stock is checked separately from the threshold. But you will *not* see a LOW amber badge between, say, "20 left" and "1 left". Set a real threshold per product.

**Bulk receiving via CSV.** Not yet exposed on the Stock screen. For now, the workflow for a 100-line invoice is: scan each barcode + adjust. Bulk-receive via CSV is on the same Phase 2 backlog as the per-store threshold editor — see Chapter 5 for the existing catalogue CSV import.

---

## 8.10 What's recorded in the audit log

Every stock movement creates **two** records:

1. **A `stock_movements` row** — the operational ledger. Available immediately from the History modal (§8.5) and from `GET /api/products/{id}/stock-history`. Append-only at the model layer (`static::updating(fn () => false)` and `static::deleting(fn () => false)`).
2. **An `audit_logs` row** — the compliance ledger, hash-chained. Visible on the Audit Log screen (Chapter 13). Records: who did it, IP address, the old and new `stock_qty` values, the reason, the note. Cannot be modified or deleted by *anyone*, including Super Admin.

Sales, voids, and refunds also create both records. When in doubt, the audit log is the canonical "what really happened" view; the stock-movement history is the convenient per-product view.

> **For Rekenkamer compliance:** the signed PDF export (Chapter 13) includes all stock movements with a reason of `adjustment`, `import`, or `initial` — i.e. every manual intervention by a human. Sales-driven movements (`sale`, `void`, `refund`) are derivable from the transaction history and aren't duplicated in the stock section of the export.

---

## 8.11 Quick reference

```
OPEN STOCK SCREEN     Dashboard → sidebar → Voorraad / Stock
SEE LOW-STOCK ONLY    Top-of-page yellow banner → "Review now"
                      OR Stock screen → Low stock tab
                      OR Dashboard home → yellow Stock alerts tile

ADJUST STOCK          Stock screen → find product → + Adjust
                      → enter signed qty + reason + notes → Save

RECEIVE A DELIVERY    Stock screen → scan barcode → + Adjust
                      → +qty, reason: Stock received, note: invoice ref → Save

WRITE-OFF             Stock screen → find product → + Adjust
                      → −qty, reason: Correction, note: specific reason → Save

VIEW MOVEMENT HISTORY Stock screen → row → History
                      Newest 50, append-only, includes user + notes

SET MASTER THRESHOLD  Catalogue → Products → Edit → low_stock_threshold
                      Applied to new (product, store) pairs as default
```

For everything cross-referenced above: see [Chapter 1 — Roles & permissions](01-roles-and-permissions.md) for who can adjust vs view, [Chapter 4 — Catalogue & categories](04-catalogue-and-categories.md) for setting the master `low_stock_threshold`, and [Chapter 13 — Audit log](13-audit-log.md) for the hash-chained compliance view of every adjustment.

---

→ Next: [Chapter 9 — Customers](09-customers.md)
