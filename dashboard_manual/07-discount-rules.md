# Chapter 7 — Discount rules

**Who needs this:** **Organisation Admin** (set rules across the whole org or scoped to one store) and **Store Manager** (create, edit, deactivate rules for their own store). Cashiers see active rules at sale time but can't create them — by design, see [Chapter 1's permission matrix](01-roles-and-permissions.md#13-the-permission-matrix).

**When you do it:** running a Mother's Day promotion (10 % off all bakery for a week), a permanent senior-discount on one product category, matching a competitor on a single store's cola price for the weekend, or a "buy 5 get 1 free" stock-clearance on a discontinued line.

**Why this prevents pain:** without discount rules, every cashier would apply manual line-item or basket discounts based on a printed memo — and you'd lose all traceability ("why did Kassa 3 give 15 % to that customer?"). With rules, the discount is **automatic**, **bounded**, **time-windowed**, and **logged**.

> _Screenshot placeholder: `dashboard_manual/screenshots/07-discount-rules-list.png`_

---

## 7.1 What a discount rule does

A rule is a small set of conditions plus an action:

```
WHEN  the cart contains a matching product (or category, or anything at all)
AND   the current date is within the rule's [valid_from, valid_to] window
AND   the rule is_active = true
THEN  reduce the line price by X percent  -OR-
      reduce the line price by SRD X     -OR-
      apply a buy-X-get-Y-free pattern
```

The rule is evaluated **at the POS, at the moment the cashier adds a product or rings up the sale**. It doesn't change the master price on the catalogue; it leaves the master price visible on the receipt and adds a `Korting / Discount` line underneath. That's the format Belastingdienst expects on every receipt — the BTW is then recalculated on the discounted amount (Surinamese rule: discount before BTW extraction).

### The three "applies to" scopes

The rule's `applies_to` field decides what kind of cart item it watches:

| Dashboard form value | Backend canonical value | Triggers on | Example |
|---|---|---|---|
| **Alle producten / All products** | `cart` | Every line in the cart. Effectively a cart-level discount. | "10 % off everything until end of May." |
| **Categorie / Category** | `category` | Cart lines whose product belongs to the chosen category. | "15 % off all Bakkerij (bakery) on Sundays." |
| **Specifiek product / Specific product** | `product` | One specific product (matched by `applies_to_id`). | "SRD 2 off Cola 1.5L." |

> **One subtle drift to know about:** the dashboard form labels the cart-wide scope as **Alle producten / All products**, while the underlying API stores it as `cart`. Same thing. If you ever query the database directly or call the API from a third-party tool, expect to see `cart`, not `all`.

### The three discount types

The rule's `type` field decides how the discount is calculated:

| Dashboard form value | Backend canonical value | What `value` means | When to use |
|---|---|---|---|
| **Percentage (%)** | `pct_discount` | `10` = 10 % off. The cap `max_discount_srd` puts a ceiling in SRD. | Most promotions. Self-scaling with price. |
| **Vast bedrag (SRD)** | `fixed_discount` | `5.00` = SRD 5.00 off the line, per unit. | "SRD 5 off any cola" — works regardless of cola variant pricing. |
| **(API only)** | `buy_x_get_y` | `value` = the free quantity. `min_qty` = the buy threshold. | "Buy 5 get 1 free" stock clear. Not exposed in the dashboard form yet — see §7.9. |

> Just like the scope, the form simplifies the labels. Behind the scenes the backend stores the canonical `pct_discount` / `fixed_discount` / `buy_x_get_y`. The translation happens server-side on save.

### The store scope (org-wide vs store-specific)

Every rule belongs to an organisation. Additionally, each rule has an optional `store_id`:

- `store_id = null` (the default when creating from the current dashboard form) → **applies to every store in the org**.
- `store_id = <one store>` → **applies only at that store**. Set via API or a developer; the current form doesn't expose this dropdown.

The Store Manager-created rules are auto-scoped to their store; Org Admin rules default to org-wide unless changed. This means a store-specific senior-citizen promotion only burns at that branch — useful for matching a local competitor without spilling across the chain.

---

## 7.2 The entities

| Table | Purpose | Key columns |
|---|---|---|
| `discount_rules` | One row per rule. | `id`, `organisation_id`, `store_id` (nullable), `name`, `applies_to`, `applies_to_id`, `type`, `value`, `min_qty`, `max_discount_srd`, `stackable`, `is_active`, `valid_from`, `valid_to`, `created_by` |

Foreign keys cascade: delete an organisation → rules go. Delete a store → rules belonging to *just that store* are unlinked (set to `null`, which makes them org-wide — be aware of this). Deleting a product or category that a rule points to via `applies_to_id` doesn't break the rule; it just stops matching anything until you fix `applies_to_id`.

The **`scopeActive`** model scope (used by the POS when it asks for "rules to apply now") returns only rules where:

```sql
is_active = true
AND (valid_from IS NULL OR valid_from <= now())
AND (valid_to   IS NULL OR valid_to   >= now())
```

— evaluated in **AST** (America/Paramaribo, UTC-3), which is the system-wide timezone for all timestamps.

---

## 7.3 Step-by-step — creating a percentage rule

**Path:** Dashboard → sidebar → **Kortingsregels / Discount Rules**.

> _Screenshot placeholder: `dashboard_manual/screenshots/07-new-rule-modal.png`_

1. Top-right of the screen → **+ Nieuwe regel / + New rule**.
2. The modal opens. Fill in:

   | Field | What to type | Notes |
   |---|---|---|
   | **Naam / Name** | `Zomerkorting 10%` | Human-readable. Shows in the rules list and on the audit log. Not seen by the customer. Max 200 chars. |
   | **Type korting / Discount type** | `Percentage (%)` | Default. Stored as `pct_discount` on the backend. |
   | **Waarde / Value** | `10` | The percentage. `10` means 10 % off. |
   | **Van toepassing op / Applies to** | `Alle producten / All products` | Cart-wide. (Or pick Category / Specific product — see §7.4.) |
   | **Min. aantal / Min. quantity** | leave blank for "no minimum" | If set (e.g. `5`), the rule only fires when the line quantity meets the threshold. Decimals allowed (`2.5` kg). |
   | **Max. korting (SRD) / Max. discount (SRD)** | leave blank for "no cap" | If set (e.g. `50.00`), a 10 % rule on a SRD 800 sale would still only discount SRD 50. Useful guardrail. |
   | **Geldig vanaf / Valid from** | `2026-06-01` | Date picker. Leave blank for "no start". Stored as midnight AST. |
   | **Geldig tot / Valid to** | `2026-06-30` | Leave blank for "no end". Must be ≥ valid-from. |
   | **Stapelbaar / Stackable with other discounts** | unchecked (default) | If unchecked, this rule does *not* combine with other firing rules — the system picks one. If you mean "this rule plays nicely with the loyalty rule", check it. |
   | **Actief / Active** | checked (default) | Uncheck to save a draft. |

3. Click **Opslaan / Save**.
4. The rule appears in the table sorted by created-at (newest first), with status pill **Actief** in green.
5. The next sale at any till in the organisation will apply it — POS reads active rules on every cart change.

---

## 7.4 Step-by-step — a category-scoped rule

Worked example: 15 % off every bakery product, every day, no end date.

1. **+ New rule.**
2. Naam: `Bakkerij — vaste 15% korting`.
3. Type: `Percentage (%)`; Waarde: `15`.
4. Van toepassing op: **Categorie / Category**.
5. A new field **ID van categorie/product / Category/product ID** appears under it.
6. **Find the category's UUID.** This is the awkward bit — the current form expects you to paste the UUID:
   - Open a new browser tab.
   - Go to **Catalogue → Categories**.
   - Right-click on the *Bewerken / Edit* button for "Bakkerij" → *Inspect element*, or look at the URL after clicking edit — the UUID appears in the API call.
   - Or ask a developer to read it from `SELECT id FROM categories WHERE organisation_id = … AND name_nl = 'Bakkerij'`.
7. Paste the UUID into the field.
8. Leave Min. qty, Max. discount, and the date range blank (it's a permanent rule).
9. **Stapelbaar** off — bakery customers shouldn't double-dip with the org-wide rule.
10. **Opslaan.**

The first cashier to scan a bakery item after save will see the discount line on the cart.

> **The UUID-paste step is a known rough edge.** A category/product picker is on the roadmap. Until then, the workaround is documented in the rough-edges section (§7.10).

---

## 7.5 Step-by-step — a product-scoped time-limited rule

Worked example: SRD 2 off Cola 1.5L for one weekend only (Sat 1 Jun to Sun 2 Jun 2026).

1. **+ New rule.**
2. Naam: `Cola weekend deal — 1-2 juni`.
3. Type: **Vast bedrag (SRD) / Fixed amount (SRD)**.
4. Waarde: `2.00` (SRD 2 off per unit).
5. Van toepassing op: **Specifiek product / Specific product**.
6. ID van product: paste the product's UUID (same UUID-finding workaround as §7.4 — but for Catalogue → Products).
7. Min. aantal: leave blank.
8. Geldig vanaf: `2026-06-01`. Geldig tot: `2026-06-02`.
9. Actief: ✓. Stapelbaar: leave off.
10. **Opslaan.**

After Sunday night the rule auto-expires — the `scopeActive` check fails (`valid_to < now()`), and the POS stops applying it without anyone touching anything. The rule row stays in the table for the audit trail; you'll see it as **Inactief** in grey on Monday morning.

> The dashboard does **not** auto-delete expired rules. They sit in the table as a permanent record. If you want to re-run the same promotion next year, edit the dates and reactivate — no need to recreate.

---

## 7.6 Toggling, editing, and deleting

The table at the bottom of the screen shows every rule grouped by status — active rules first (full opacity), inactive ones below at 50 % opacity.

| Action | Where | What it does |
|---|---|---|
| **Toggle active** | Status pill in the row (`Actief` / `Inactief`) | One click. Active rules stop firing instantly; inactive rules start firing instantly. No reload needed at the tills (rules are queried on every sale). |
| **Bewerken / Edit** | Grey *Edit* button in the row | Opens the same modal, pre-filled. Save replaces the existing row. |
| **✕ Delete** | Red ✕ button in the row | Confirm prompt. Permanently removes the rule row. **Past sales are not affected** — the discount they recorded is part of the immutable sale record. |

If you've made a mistake on a fresh rule, **delete is fine**. If you've had the rule running for a while and want to retire it, **toggle Inactief** rather than deleting — that way the rule's history (and the link from past sales saying "this rule fired here") stays meaningful.

---

## 7.7 How rules combine with each other

You can have many active rules at once. When a cashier rings up a product, the POS:

1. Asks the backend for all rules where `is_active = true` AND `now()` is in the validity window AND the rule's store scope matches (this store *or* null).
2. Splits them into the three priority buckets:
   ```
   Bucket 1: product-specific rules (applies_to = 'product', applies_to_id = this product)
   Bucket 2: category rules         (applies_to = 'category', applies_to_id = this product's category)
   Bucket 3: cart-level rules       (applies_to = 'cart')
   ```
3. For each bucket, picks the **single best-matching non-stackable rule** OR — if `stackable = true` — keeps all matching rules.
4. Applies the discounts in order (Bucket 1 → 2 → 3) so a product-specific deal takes precedence over a category rule, which takes precedence over a cart-wide rule.
5. Recomputes BTW on the **discounted** line totals — Surinamese tax rule is *discount before BTW extraction*.

In practice: **leave Stapelbaar off** unless you've thought carefully about how two rules interact. Double-stacking is the easiest way to give a customer a 30 % discount when you meant 10 %.

The **`max_discount_srd`** cap is your safety net on percentage rules. A `10 %` rule with `max_discount_srd = 50.00` on a SRD 800 cart still costs you only SRD 50 — without it you'd be giving SRD 80 away.

---

## 7.8 What the cashier sees (and what the receipt shows)

From the till side, discount rules are invisible until they fire. When one does:

- The cart line shows the original price struck through, with the discount price underneath.
- A small **Korting** / **Discount** caption shows the rule name (`Bakkerij — vaste 15% korting`) so the cashier knows why the price changed.
- The receipt subtotal shows the **gross subtotal** (before discount), then a **Korting / Discount** line, then **Subtotaal na korting / Subtotal after discount**, then BTW, then total.

This is the format Belastingdienst Suriname expects for receipts where discounts have been applied. The line is not optional — if you bake the discount into the line price and skip the discount line, your BTW report won't match.

A cashier can also apply a **manual** line-item or sale-level discount on top — that's a different mechanism (see [Chapter 8 of the POS User Manual](../user_manual/08-discounts.md)). Discount rules apply first; manual on top.

---

## 7.9 The buy-X-get-Y rule type

The backend supports a third rule type, `buy_x_get_y`, used for "buy 5 get 1 free" patterns:

```
type:    buy_x_get_y
value:   1           ← the free quantity
min_qty: 5           ← the buy threshold
```

When the cart contains 5 units of the matching product (or 10, or 15), one (or two, or three) units worth of line price is removed as a discount.

The current dashboard form **does not expose this type** — the dropdown only offers `Percentage` and `Vast bedrag`. To create a buy-X-get-Y rule today, a developer needs to POST to `/api/discount-rules` directly. A form option is on the roadmap.

---

## 7.10 Known rough edges (and the workarounds)

| Rough edge | Workaround |
|---|---|
| Category / product fields ask for a UUID, not a picker. | Open Catalogue in a separate tab, find the entity, copy the UUID from the URL after editing. Or use the browser's network panel to capture the ID. A picker is on the roadmap. |
| The "Applies to" dropdown labels `All / Category / Product` but the API stores `cart / category / product`. | Cosmetic — no action needed. If you query the database, expect `cart`. |
| The "Type" dropdown labels `Percentage / Fixed` but the API stores `pct_discount / fixed_discount`. | Cosmetic — no action needed. If you call the API directly, use the canonical names. |
| The dashboard doesn't show which store(s) a rule is scoped to — every rule looks org-wide. | The current form always creates org-wide rules. Store-scoping requires API. The table-column-with-store-pill is on the roadmap. |
| `buy_x_get_y` is unavailable in the form. | Use the API. See [Chapter 12 — API integrations & webhooks](12-api-integrations-and-webhooks.md). |
| Expired rules sit in the table as Inactief; the list grows over time. | This is on purpose for the audit trail. Filter the rule list visually, or delete genuinely obsolete rules (the past sales are unaffected). |
| Two managers create rules with the same name. | Names are not enforced unique. Use a date or store prefix (`Nickerie — Bakkerij 15%`) to avoid confusion. |
| You set `min_qty = 5` thinking it means "minimum 5 SRD". | `min_qty` is the **quantity** threshold, not the price threshold. There's no "minimum sale value" rule type in this release. |

---

## 7.11 Common mistakes

| Symptom | Likely cause | Fix |
|---|---|---|
| Rule shows **Actief** but doesn't fire at the till | Validity window already in the past, OR you're at a store that doesn't match the rule's `store_id`, OR the product/category UUID is wrong. | Check the dates. If in window, check the UUID — paste it back into Catalogue search to confirm it points at what you think. |
| Rule fires twice (customer gets 20 % off instead of 10 %) | Two rules both match this product and at least one is marked **Stapelbaar / Stackable**. | Edit the rules and turn off stackable on the one that shouldn't compound. |
| Percentage rule of 100 % was applied (item went free) | Someone typed `100` in Waarde. Or a typo `1000` was clamped somewhere. | Edit the value. Set a `max_discount_srd` cap as belt-and-braces. |
| Discount appears at one till but not another | Connected POS terminal is offline or hasn't refetched rules since the toggle. | Most tills refetch on every sale; a hard refresh on the offline terminal solves it once it's back online. |
| You set Geldig tot = 1 June 2026 and the rule stops firing on the morning of 1 June, not the end of 1 June | The date is stored as midnight AST. "Valid to" is inclusive of the date but at 00:00. | If you want a rule active *through* 1 June, set Geldig tot = `2026-06-02`. |
| You toggled a rule off but a sale that was already in progress when the toggle happened still got the discount | Rules are evaluated when the line is added, not at checkout. | The toggle only affects new cart lines added after the toggle. Existing carts keep what they had. |
| Negative-amount value gets rejected | The validator requires `value >= 0.01`. Discounts can't be zero or negative. | If you want zero discount, deactivate the rule instead. If you want a price *increase* (surcharge), that's not a discount rule — use a per-store price override ([Chapter 6](06-pricing-and-per-store-overrides.md)). |
| You hit Save and get *"applies_to_id is required when applies_to is product or category"* | You selected `Categorie` or `Specifiek product` but left the UUID field blank. | Paste the UUID. Or change `Van toepassing op` to `Alle producten`. |

---

## 7.12 What's recorded in the audit log

Every discount-rule mutation is a high-impact event — a misconfigured rule can give away thousands of SRD over a weekend before anyone notices. The audit pipeline records:

- The **action** (`created`, `updated`, `deleted`, or `is_active` toggled).
- The **user** who made the change (their dashboard account + IP address).
- The **organisation** and (if scoped) **store**.
- The **before and after** JSON of every field — `name`, `type`, `value`, `min_qty`, `max_discount_srd`, `stackable`, `is_active`, `valid_from`, `valid_to`.
- The **timestamp** in AST.

In addition, every sale records which rules fired on it (in the sale line's discount breakdown) — so the question *"why did Kassa 2 give a 15 % discount on transaction #4523?"* has an answer: "rule `Bakkerij — vaste 15% korting` (uuid: …) was active and the cart contained two bakery items".

Auditors and Org Admins can see both layers in [Chapter 13 — Audit log](13-audit-log.md). The audit log is append-only — a Store Manager who later regrets creating a rule cannot make the audit row disappear.

---

## 7.13 Permission and role recap

From [Chapter 1's matrix](01-roles-and-permissions.md#13-the-permission-matrix):

| Role | View rules | Create / edit / delete |
|---|:-:|:-:|
| Super Admin | ✅ | ✅ |
| Organisation Admin | ✅ | ✅ |
| Store Manager | ✅ | ✅ (scoped to rules they can manage in their store) |
| Cashier | ✅ (read-only — POS reads active rules at sale time) | ❌ |
| Auditor | ✅ | ❌ |
| API Integration | ❌ | ❌ |

The backend enforces this via the `discount_rules.manage` permission gate on every mutation route — not just in the UI. A Cashier who somehow reaches the API gets a 403.

---

## 7.14 Quick reference

```
CREATE A RULE         Dashboard → Discount Rules → + New rule
                      → name, type, value, applies_to, dates → Save
TOGGLE A RULE         Click the Actief / Inactief pill in the row
EDIT A RULE           Edit on the row → modify → Save
DELETE A RULE         ✕ on the row → Confirm  (use Toggle Inactief instead
                      if the rule has fired in real sales — keeps the trail)

THE THREE SCOPES      All products  (backend: cart)
                      Category      (needs category UUID in applies_to_id)
                      Specific product (needs product UUID in applies_to_id)
THE THREE TYPES       Percentage (%)            → backend: pct_discount
                      Fixed amount (SRD)        → backend: fixed_discount
                      Buy X get Y (API only)    → backend: buy_x_get_y

GUARDRAILS            min_qty           = threshold quantity to trigger
                      max_discount_srd  = cap per line (use this on % rules!)
                      stackable=false   = only this rule fires from its bucket
                      valid_from/to     = ISO date, midnight AST, inclusive
APPLIED               at every cart change at the till; recomputed each line
                      BTW recalculated AFTER discount (Suriname rule)
ROLES                 Super Admin · Org Admin · Store Manager (mutations).
                      Cashier · Auditor (read-only).
```

Stuck? See [Chapter 4](04-catalogue-and-categories.md) for catalogue concepts, [Chapter 6](06-pricing-and-per-store-overrides.md) for per-store price overrides (the longer-term cousin of a time-limited rule), [Chapter 8 of the POS User Manual](../user_manual/08-discounts.md) for what the cashier sees, and [Chapter 13](13-audit-log.md) for the audit trail.

---

→ Next: [Chapter 16 — License operations](16-license-operations.md) *(chapters 8-15 coming soon)*
