# Chapter 9 — Customers

**Who needs this:** Store Manager (looks up regular customers, fixes typos in details, reviews top spenders) and Organisation Admin (CSV-imports an existing customer base when migrating from another POS, runs cross-store reports on loyal customers).
**When you use it:** when a customer wants their receipt emailed, when an old phone number needs updating, when a new shop opens with a hand-typed Excel list of existing regulars to load in one go.
**What it prevents:** missed re-orders from forgotten loyal customers, WBP-S compliance findings against personally identifiable data sitting in plaintext, the back-office accidentally exporting a CSV of customer phone numbers to a vendor's email.

The Customers screen is where you read, edit, and import customers. Cashiers create new customers on-the-fly from the POS app — they don't need the dashboard for that. The dashboard is for the back-office views: search, edit, bulk import, top-spender reports.

![09 customers list](screenshots/09-customers-list.png)
---

## 9.1 The model — why customer data is special

In Josbin POS, a customer record holds **personally identifiable information (PII)** that falls squarely under **WBP-S** (*Wet Bescherming Persoonsgegevens Suriname*, the Surinamese personal-data protection law). That has direct consequences for how the data is stored and what you can do with it.

```
ORGANISATION
   │
   └── customers
         │
         ├── id              (uuid, plain)
         ├── name            ←─── AES-256 encrypted at rest + HMAC name_hash for exact-match search
         ├── phone           ←─── AES-256 encrypted + HMAC phone_hash for exact-match search
         ├── email           ←─── AES-256 encrypted (no search hash)
         ├── id_number       ←─── AES-256 encrypted, WBP-S "bijzondere persoonsgegevens" (government ID)
         ├── total_spend_srd (DECIMAL 12,2, plain — updated by every sale)
         ├── visit_count     (integer, plain — updated by every sale)
         └── created_at      (timestamptz AST)
```

Two encryption mechanisms are at work, and both matter for how the screen behaves:

| Mechanism | What it does | Why |
|---|---|---|
| **`Crypt::encryptString()`** on the four PII fields | Stores AES-256 ciphertext in Postgres. Decrypts only inside the Laravel app, via the per-app encryption key. | WBP-S compliance: if someone gets a raw DB dump, they see opaque ciphertext, not phone numbers. |
| **`hash_hmac('sha256', value, app.key)`** on name + phone | Stores a fixed-length HMAC alongside, so we can run an exact-match query (`WHERE phone_hash = ?`) without decrypting every row. | Allows search without breaking encryption. Trade-off: no partial / starts-with / fuzzy search. |

> **Why `id_number` doesn't get an HMAC hash:** government ID numbers are *bijzondere persoonsgegevens* under WBP-S and may only be stored for narrow legal purposes (e.g. issuing a receipt to a government department for a tax-deductible purchase). They are deliberately *not* searchable to discourage them being used as a lookup key.

### Practical consequences of the encryption

| Behaviour | Why |
|---|---|
| You can **only search by an exact full name or exact phone number** — `"Sandra"` will not find `"Sandra Codrington"`. | Search uses the HMAC hash of the *exact lowercased* search term — partial matches would require decrypting every customer row, which is a WBP-S violation. |
| The list **always paginates by recency** (`created_at DESC`) rather than by name. | Sorting alphabetically would require decrypting every row in the org before paginating. Recency is free. |
| **Email search is not supported**. | No HMAC hash for email — would have to decrypt every row. |
| **Raw DB exports are useless** to a thief without the app key. | That's the whole point. |
| Two records with the same *exact* name will share the same `name_hash`. | Expected — HMAC is deterministic with the same key. |

---

## 9.2 Where customers come from

Three creation paths feed the same `customers` table:

| Source | Triggered by | Used when |
|---|---|---|
| **POS cashier — quick-add** | Cashier taps "+ New customer" mid-sale on the POS app | The most common path. Customer wants their receipt emailed, or it's a regular wanting their visit count to keep ticking. Name + phone is the minimum. |
| **Dashboard — Edit** | Org Admin or Manager edits an existing record | Fixing typos, updating numbers, adding an email after the fact. There is no Create button in the dashboard — quick-add lives at the till. |
| **Dashboard — Bulk CSV import** | Org Admin uploads a CSV via the API endpoint | One-off when a new client migrates from another POS (or a single-shop owner opens their first Josbin POS terminal and wants their existing regulars loaded). |

> **Why no "Add customer" button in the dashboard?** Single-shop and small-chain workflows almost always create customers at point-of-contact — the cashier asking "want a receipt emailed?". The dashboard's role is review, fix, and bulk-load — not data entry. If you have a use case for one-by-one add from the back office, the API endpoint (`POST /api/customers`) supports it; the UI just doesn't expose a button.

---

## 9.3 The Customers screen — what's on it

**Path:** Dashboard sidebar → **Klanten / Customers**.

![09 customers screen](screenshots/09-customers-screen.png)
The page shows a single searchable, paginated table. The header counter (`123 klanten gevonden / 123 customers found`) reflects the **total in your organisation**, not just the current page.

### The columns

| Column | What it shows | Notes |
|---|---|---|
| **Naam / Name** | Customer's full name, with an auto-generated 2-letter avatar (first letter of first + last name word). | Decrypted on read by the Laravel controller. Never appears in the raw DB. |
| **Telefoon / Phone** | Free-text phone — usually with Suriname country code (`+597 …`). | `—` if missing. Decrypted on read. |
| **Email** | Lowercase email. | `—` if missing. Decrypted on read. |
| **Totaal besteed / Total spend** | Lifetime SRD spend across the organisation, incremented on every completed sale. | Plain `DECIMAL(12,2)`. Across all stores within the org. |
| **Bezoeken / Visits** | Lifetime visit count across the organisation. | Plain integer. One unique sale = one visit. |
| **Klant sinds / Customer since** | First time the customer was created (i.e. their first POS encounter). | Localised: `26 mei 2026` (NL) / `May 26, 2026` (EN). |
| **(action)** | **Bewerken / Edit** button; for Org Admin and Super Admin also a red **Wissen / Erase** button. | Edit opens the modal — §9.5. Erase is the WBP-S erasure action — §9.5a. |

### The search box

Type a search term and hit Enter / wait — the table filters as you type, page resets to 1.

| What you type | What it matches |
|---|---|
| **Full name** (any case) — `Sandra Codrington` | Exact match against `name_hash` (lowercased). `sandra codrington` works too. |
| **Phone number** — `+5978554120` or `8554120` | Exact match against `phone_hash`. The format must be **byte-for-byte identical** to how it was stored. |
| Partial — `Sandra` | Returns **nothing**. Partial matches are not technically possible (see §9.1). |
| Email — `sandra@…` | Returns **nothing**. Email is encrypted with no hash — see §9.1. |

> **Best-practice tip for cashiers.** When quick-adding a customer at the POS, *standardise the phone format* — e.g. always `+597XXXXXXX`, never a mix of `+597`, `0`, and spaces. If two cashiers store the same person with different formats, they'll show as two customers and never be findable via search.

---

## 9.4 Reading a row — what the spend / visit numbers mean

`total_spend_srd` and `visit_count` update on **every completed sale** that names this customer. They count the gross sale total (before any individual-line discounts but after a sale-level discount — i.e. what the customer actually paid), in SRD, at the locked exchange rate of the day.

| Event | Effect on `total_spend_srd` | Effect on `visit_count` |
|---|---|---|
| Sale completed and the customer was picked at the till | `+ total_srd` | `+ 1` |
| Sale **voided** before printing | no effect (the sale was never "completed") | no effect |
| Sale **refunded** | currently *not* decremented (visit count and lifetime spend reflect engagement, not net revenue) | no effect |
| Sale recorded against the **default walk-in** customer | no effect (walk-in is a system customer, not in this list) | no effect |

> **Why refunds don't reduce lifetime spend.** The number is a **loyalty / engagement metric**, not an accounting figure. If a customer spent SRD 500 in lifetime visits and refunded one item, they still *spent* SRD 500. Net-of-refunds revenue is what the Sales reports (Chapter 10) are for.

---

## 9.5 Editing a customer

**Path:** Customers screen → find the row → tap **Bewerken / Edit**.

![09 edit modal](screenshots/09-edit-modal.png)
The modal exposes three fields:

| Field | Required | Notes |
|---|:-:|---|
| **Naam / Name** | ✅ | Replacing the value also re-computes the `name_hash` automatically — future searches use the new value. |
| **Telefoon / Phone** | optional | Same: editing recomputes `phone_hash`. Leave blank to clear. |
| **Email** | optional | Lowercase + 254-char standard email validation. Leave blank to clear. |

Tap **Opslaan / Save**. The row updates immediately, and the change is recorded in the **audit log** (Chapter 13) with the old and new values shown as part of the standard diff — but with the values redacted as encrypted strings, so the auditor sees *that* something changed about a customer without seeing what.

> **What you can't edit from this screen.** `id_number` (government ID) is editable via the API but deliberately not surfaced in the dashboard edit modal — it's a *bijzondere persoonsgegeven* and shouldn't be casually corrected by back-office staff. If a govt ID needs updating, that's a vendor support request with a written reason.

> **Deleting vs erasing.** There is deliberately no hard-delete — removing the row would orphan every historical sale that ever named the customer and break the audit trail. What *does* exist is a WBP-S **erasure** action that redacts the personal data while keeping the sales history on a tombstone record — see §9.5a.

---

## 9.5a Erasing a customer's personal data (WBP-S right to erasure)

When a customer invokes their WBP-S *recht op vergetelheid* ("erase everything you have about me"), an **Organisation Admin or Super Admin** handles it directly from the Customers screen — no vendor ticket needed.

**Path:** Customers screen → find the row → **Wissen / Erase** (next to Edit).

### Who can do it

| Role | Allowed? |
|---|---|
| **Super Admin** | ✅ |
| **Organisation Admin** | ✅ — own organisation only. |
| **Store Manager / Cashier / Auditor** | ❌ — the button isn't rendered, and the API refuses (`CustomerPolicy::delete`). Erasure is a data-controller decision, not a store-floor action. |

### What it does — redaction, not deletion

This is an **irreversible redaction**, engineered so the WBP-S right and the bookkeeping/audit obligations don't collide:

| Field | After erasure |
|---|---|
| **Name** | Replaced by the tombstone value `[verwijderd — WBP-S]`. |
| **Phone / email / ID number** | Erased outright. |
| **Search hashes** (`name_hash`, `phone_hash`) | Nulled — the tombstone can never be found via search again. |
| **`total_spend_srd` / `visit_count`** | **Kept.** Aggregate numbers are not personal data. |
| **Sales history** | **Kept.** Every historical sale keeps pointing at the tombstone record, so reports, BTW filings and the Rekenkamer export are untouched. |
| **`is_active`** | Set to `false`. |

Because the row survives as a tombstone, nothing downstream breaks: the May BTW report renders the same the day after an erasure as the day before.

### The confirmation dialog

Erasure is one click away from permanent, so the dialog spells out the consequence before you confirm: *"Name, phone, email and ID for … will be permanently erased (WBP-S right to erasure). Sales history and totals are kept. This cannot be undone."* — confirm with **Definitief wissen / Erase permanently**. There is no undo, no grace period, no recycle bin.

### What lands in the audit log

A `customer.redacted` event on the hash-chained audit log (Chapter 13): who did it, when, from which IP, for which customer id — and **no plaintext PII**, old or new. The auditor can prove the erasure happened and was authorised without the log becoming a back-door copy of the data that was just erased.

> **API path:** `DELETE /api/customers/{id}` — source `backend/app/Http/Controllers/Api/CustomerController.php::destroy`. Same policy gate as the button.

---

## 9.6 Bulk CSV import

When a client migrates from another POS — or a single-shop owner opens their first Josbin POS install with a long-standing customer list in Excel — you can bulk-import the lot.

> **Where the UI is.** As of this release, the CSV-import button is **not exposed on the Customers screen**. The endpoint (`POST /api/customers/import`) exists and is wired up; the UI affordance is on the same Phase 2 backlog as the per-store stock threshold editor. Until then, the import is run from the API directly (vendor support task) or from the **Catalogue → Import / Export** screen if that operator role surfaces it.

The CSV format is small and strict:

### CSV format

A single header row, then one data row per customer.

| Column | Required | Notes |
|---|:-:|---|
| `name` | ✅ | Full name. Rows with empty `name` are skipped. |
| `phone` | optional | Used as the **match key** for upserts — see below. |
| `email` | optional | Lowercase recommended. |
| `id_number` | optional | Government ID. Loaded only if present — encrypted on write. |

Example:

```csv
name,phone,email,id_number
Sandra Codrington,+5978554120,sandra@dehoop.sr,
Rashied Alibaks,+5978900123,,
Maria van der Berg,+5978112233,maria@example.sr,N12345678
```

### What the import does, row by row

For each data row:

1. If `name` is empty → **skipped** (counted in `skipped`).
2. If `phone` is present → look up an existing customer in this organisation with the same phone (HMAC match). If found → **update** that customer's fields. If not → **create** a new customer.
3. If `phone` is empty → **always create** a new customer. (No de-duplication possible — the system has nothing to match on.)
4. The whole import runs inside a single DB transaction. Any thrown error rolls back the whole batch — partial imports never land.

Response:

```json
{ "created": 42, "updated": 7, "skipped": 1, "errors": ["Row 13: column count mismatch"] }
```

> **Phone is the de-duplication key.** If you re-import the same CSV twice, the second run reports `updated: 49, created: 0` — every record matches the phone hash from the first run and gets its fields re-written. This is intentional and safe; just be aware that re-running an outdated CSV will *overwrite* manual edits made in the dashboard since.

> **5 MB cap.** The endpoint caps the upload at 5 MB. For a typical CSV (~150 bytes per row), that's roughly 33,000 customers in one go. Larger lists need to be split.

---

## 9.7 The default walk-in customer

Every sale that does **not** name a specific customer is recorded against the organisation's "walk-in" customer. The walk-in customer:

- Is a single, system-managed record per organisation.
- Does **not** appear in the Customers screen list.
- Does not accumulate `total_spend_srd` or `visit_count` (it would distort the top-spender lists).
- Cannot be edited or deleted.

This is mostly invisible to back-office users — the only reason to know about it is when reviewing the Top Customers report (Chapter 10): walk-in is excluded from the top-N list, which is why the totals on that report won't match total daily revenue.

---

## 9.8 Common mistakes / gotchas

**"I searched for Sandra and got nothing."** Search needs the **exact full name** (case-insensitive). "Sandra" alone won't match "Sandra Codrington". This is a deliberate WBP-S design choice — partial search would require decrypting every row.

**"Why is this person listed three times?"** Almost always because three different cashiers stored the phone in three formats: `+5978554120`, `0085554120`, and `08554120`. The HMAC sees three different strings → three different hashes → three different customers. Fix: at training time, agree one phone format and stick to it. To merge duplicates, the safest path is editing all three rows to point at one canonical phone (each edit recomputes the hash; old rows become non-findable by phone but still exist).

**"I want to export a CSV of customers for our newsletter."** This is **not provided as a one-click export** by design — bulk customer extraction is a WBP-S risk. If the customer's stated processing purpose (the *verwerkingsdoel* declared in the Verwerkersovereenkomst) includes marketing, the vendor can produce the export on written request. Don't try to scrape it via the API on your own initiative — that gets logged.

**"I erased a customer but a row is still there."** Correct — erasure (§9.5a) is a *redaction*, not a row delete. The tombstone row (name `[verwijderd — WBP-S]`, no phone/email) stays behind so historical sales and reports keep working, but the person's data is gone and the row can no longer be found via search. There is deliberately no way to remove the row itself.

**"A Store Manager needs to handle an erasure request."** They can't — the Erase button is OA + Super Admin only (§9.5a). Have the manager forward the customer's request to the Org Admin; erasure is a data-controller decision under WBP-S, not a store-level action.

**"Edit modal shows the email field but I can't type into it for an existing customer."** You can. Make sure the field isn't being rendered behind another element (rare browser glitch — full-page refresh fixes it). If the field is literally read-only and rejects keypresses, this is a bug — report to vendor support.

**"Total spend went up but visit count didn't."** Shouldn't happen. If it does, this is a bug — every completed sale should increment both. Open the audit log (Chapter 13) and find the sale, then check whether one was rolled back partway. Then file a vendor ticket.

**"Importing a CSV created duplicates."** The CSV either didn't include phone numbers (no match key — always creates), or the phone format in the CSV didn't match the format already in the database. Standardise both, re-import, accept the second-round duplicates as cleanup (then merge as described above).

---

## 9.8a Customer detail view — purchase history & statement

Click any customer row (or its **Details** button) to open the customer's
detail page:

- **Profile block** — the contact fields, plus the running aggregates:
  total spend (SRD), number of visits, and the last visit date.
- **Purchase history** — every sale attributed to this customer, newest
  first, paginated: sale number, date, store, payment method, total and
  BTW. Refund legs show as negative rows flagged *refund*; voided sales
  show their status.
- **Statement download** — pick a date range (default: the last 90 days)
  and export a formal statement as **PDF** (letterhead-style, bilingual by
  your language setting) or **CSV**. The footer nets it out: gross sales,
  refunds, BTW, and the net amount. Useful for business customers who ask
  "what did I buy from you this quarter?" and for reconciling a customer's
  account balance discussion.

Access follows the same rule as the rest of this screen (customer
visibility permission); a tax inspector cannot open it. Opening a detail
view or exporting a statement is itself recorded in the audit log
(`customer.accessed`, `customer.statement_exported`) — WBP-S expects PII
reads to leave a trace, and they do.

## 9.9 What's recorded in the audit log

Every action on a customer creates an entry in the audit log (Chapter 13):

| Action | Audit `event` | `old_values` | `new_values` |
|---|---|---|---|
| Created via POS quick-add or import | `created` | `null` | The new field values — **but** the PII fields are stored as their *encrypted* ciphertext in the audit. The auditor sees that a customer was created, not who. |
| Edited via dashboard | `updated` | The previous encrypted ciphertext of every changed field | The new encrypted ciphertext. The diff viewer shows two opaque strings — by design. |
| Erased via dashboard (WBP-S, §9.5a) | `customer.redacted` | `null` | `null` — deliberately no values; only the actor, customer id, IP and timestamp. The event itself is the proof. |

This means the auditor's view of the customer table is "**when** a record changed, **who** changed it, and **whether** PII was touched" — not the PII itself. That's WBP-S-correct: the audit log itself is not a back-door to read encrypted data.

The `audit_logs` row is hash-chained and append-only (see Chapter 13) so even a Super Admin cannot tamper with the record after the fact.

> **For the customer's own data-access request:** under WBP-S, a customer can ask to see "everything you have about me". The vendor's tooling (separate `php artisan customer:export` command) decrypts and dumps the lot to a signed JSON file. Don't try to assemble this by hand from the dashboard — you'll miss the encrypted fields and the audit trail.

---

## 9.10 Quick reference

```
OPEN CUSTOMERS         Dashboard → sidebar → Klanten / Customers
SEARCH                 Type exact full name OR exact phone → Enter
                       (partial / email search not supported by design)

EDIT A CUSTOMER        Row → Bewerken / Edit → change name / phone / email → Save

CREATE A CUSTOMER      Done at the POS by the cashier — no UI in the dashboard.
                       (API exists: POST /api/customers)

BULK IMPORT            Not yet in the dashboard UI. Use the API:
                       POST /api/customers/import
                       CSV columns: name (req), phone, email, id_number
                       Match key for upsert: phone (HMAC)

ERASE (WBP-S)          Row → Wissen / Erase → confirm. OA + Super Admin only.
                       Irreversible: redacts name/phone/email/ID, keeps sales
                       history + spend totals on a tombstone record.
                       Audit event: customer.redacted.

TOP SPENDERS / VISITS  Reports → Top Customers (Chapter 10)

EXPORT FOR MARKETING   Vendor support request — not a self-service action.
```

Cross-references: [Chapter 1](01-roles-and-permissions.md) for who can view vs edit, the POS User Manual for cashier-side quick-add, [Chapter 10](10-reports.md) for the Top Customers report, [Chapter 13](13-audit-log.md) for what the auditor sees when you touch a customer record.

---

→ Next: [Chapter 10 — Reports](10-reports.md) *(coming soon)*
