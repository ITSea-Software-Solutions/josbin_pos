# Chapter 21 — Tax Inspector (Belastingdienst Suriname)

This chapter covers the **tax_inspector** role — Belastingdienst Suriname's account on the platform. It's a cross-organisation, strictly read-only role limited to BTW submissions. This chapter is written for the inspector themselves (what they see), the Super Admin who creates the account, and the OA who's curious why someone outside their organisation can see their filings.

> **Why a role, not a separate portal?** The inspector uses the same identity system, the same data and the same theming, with a deliberately small feature surface — so it fits naturally as a role inside the existing dashboard rather than a separate application. This mirrors industry practice: platforms such as Stripe, Shopify Plus and Auth0 also give regulators and external auditors role-gated access to the main product.

---

## 21.1 What the tax inspector can do

A `tax_inspector` account has **cross-organisation read-only** access scoped strictly to:

| Can do | Cannot do |
|---|---|
| List every BTW submission across every org on the platform | See catalogue, products, prices |
| Filter by org / period / status / date range | See sales detail or sale items |
| Drill into a submission and see its totals + the source sale-IDs covered | See customers (any PII) |
| Accept a filed submission | Edit any data (read-only, except the accept/dispute action) |
| Dispute a filed submission with a written reason | Issue licences, manage users, manage orgs |
| See their own audit-log entries (own accept/dispute actions) | See operational data — stock, registers, Z-Reports, AI insights, etc. |
| Manage their own profile + password + 2FA | Anything in any other role's screens |

The role exists because Belastingdienst inspects across all taxpayers, not just one — that's a fundamentally different scope from the per-org `auditor` role (which is for internal compliance officers / Rekenkamer assigned to a specific ministry).

---

## 21.2 Creating a tax inspector account (Super Admin task)

**Path:** Dashboard → Platform → **Gebruikers / Users** → **+ Add user**.

Fill in:
- **Name** — the inspector's real name (e.g. "Belastingdienst Inspecteur — J. de Vries")
- **Email** — the inspector's official `@gov.sr` email
- **Role** — **Tax Inspector** in the dropdown (only Super Admin sees this option)
- **Organisation** — leave empty. Tax inspectors are cross-org by design and shouldn't be pinned to a single tenant.
- **Temporary password** — auto-generate a strong one; share it via the credentials banner that appears after creation

> **2FA is mandatory** — tax inspector is on the `TWO_FACTOR_ALWAYS_ROLES` list alongside Super Admin. On their first login the dashboard auto-prompts QR-code scan into Google Authenticator (or any TOTP app). Once confirmed, every subsequent login also needs the 6-digit code. Cannot be disabled at the policy level. See [ch 17](17-security-policy.md).

Hand them the credentials (the banner shows the temp password once). Tell them the dashboard URL.

### Demo account (for testing)

If you're working in the demo stack:
- Email: `belastingdienst@gov.sr`
- Password: `Inspector@2026`
- On first login they'll be prompted to set up 2FA — scan the QR with Google Authenticator.

> **No screenshots in this chapter (yet).** Because 2FA is mandatory and non-bypassable for this role, the headless Playwright screenshot suite can't reach the inspector's UI without a manual 2FA-secret clear via `php artisan tinker`. Run the suite by hand after clearing the secret (see the task report) to capture `21-tax-inspector-dashboard.png` and the cross-org submissions list. Until then the chapter relies on prose + the underlying screen designs you can see by logging into the demo stack directly.

---

## 21.3 What the inspector sees when they log in

After successful login (password + 2FA), the inspector is auto-routed **directly to the BTW Dashboard** — a KPI landing page giving them a network-wide snapshot before they drill into individual filings.

Their sidebar nav has exactly two sections:

```
─ COMPLIANCE ─
  BTW Dashboard                ← landing screen with KPIs, trend, top orgs, late alerts
  BTW-aangiftes / BTW Submissions  ← the full list, filterable
  Auditlogboek / Audit Log     ← their own action trail

─ ACCOUNT ─
  Mijn Profiel / My Account    ← profile + password + 2FA reset + own sessions
```

That's it. No Stores, Products, Customers, or other operational data. The role's badge in the bottom-left says **Belastinginspecteur** (NL) or **Tax Inspector** (EN).

### The BTW Dashboard (landing screen)

Four headline tiles at the top:
- **BTW this month** (with % delta vs last month — green if up, red if down)
- **Pending review** — number of `filed` submissions awaiting accept/dispute. Click to jump to the list pre-filtered to filed.
- **Open disputes** — number of `disputed` submissions awaiting taxpayer correction. Click to jump.
- **Accepted this month** — formal acknowledgements signed off.

Below: a **30-day BTW trend** sparkline (BTW collected per day) for quick eyeball of network volume.

Then two side-by-side panels:
- **Top organisations (by BTW this month)** — top 10 taxpayers ranked by BTW remitted. Click any row → list view filtered to that org.
- **Late filings (>7 days)** — orgs that haven't filed in over a week. Red flag — these are the ones to chase up. Click to jump to that org's list (which may be empty, confirming the "haven't filed" status).

Auto-refresh: every 60 seconds, no manual reload needed.

### The Submissions list

| Filter | What it does |
|---|---|
| 🔍 **Search box** | Match by reference number (e.g. `BTW-2026-05-DEHOOPP-DAY-001`) or org name. Live. |
| **Status** | `filed` (queue) / `accepted` / `disputed` / `superseded` |
| **Period** | `daily` / `monthly` |
| **Organisation** | Dropdown of all organisations on the platform |
| **POS source** | `Josbin POS` (native sales) / `External POS (API)` (Layer-3 integrators) / All |
| ✗ **Clear filters** | Pill that appears when any filter is set, one-click reset |

Click any row → opens the detail screen (§21.3a).

---

### 21.3a Submission detail screen

Opens when the inspector clicks any submission row. Replaces the previous "list-only" view with a full audit-grade picture.

**Header:** reference, organisation name + BTW number, period range.

**Status + totals tile:**
- 4 stats: Sales count · Total sales · Taxable · Exempt
- Big number: **BTW due** (the headline figure being filed)
- Status badge (Filed / Accepted / Disputed / Superseded)
- Submitted-at + by; Reviewed-at + by (if reviewed)
- **Action buttons**: ✓ Accept, ⚠ Dispute (if filed), ↺ Resubmit (if OA / SM of own org and filing is filed/disputed)

**Notes panel:** submitter note (from OA) + inspector note (from you on previous review) shown verbatim.

**Four breakdown tiles** (2×2 grid):

1. **🏬 Per store** — when an org has multiple stores, see which contributed what. Tx count + BTW per store. Useful for "store A is responsible for most of the dispute".
2. **💻 Per POS source** — **the future-proof one**. Shows whether sales came from `Josbin POS` (native) or `External POS (API)` (a third-party POS pushed sales via our Layer-3 Open Integration API). Both contribute to the BTW filing equally — the inspector sees the FULL filing regardless of which till the sale was rung on. The taxpayer's choice of POS vendor is invisible from a BTW perspective.
3. **💳 Per payment method** — cash / card / bank_transfer / mobile_transfer / foreign_cash / qr_payment. Useful for verifying cash vs bank settlement reconciliation.
4. **🧾 Per BTW rate** — the legal Belastingdienst view: 0% (exempt) vs 10% (standard) vs any custom rate, with base + BTW columns.

**🕒 Timeline:** every audit-log event touching this submission, in chronological order. Filed → reviewed → (superseded? → new filing → reviewed → …)

### 21.3b Why source POS visibility matters

Suriname's regulatory model expects BTW remittance to follow the **taxpayer (the organisation)**, not the technology stack they use. A supermarket could:

- Use Josbin POS exclusively (`source = pos` on every sale)
- Use a third-party POS that pushes sales via our `POST /v1/sales` API (`source = api`)
- Use both side-by-side (different terminals, different vendors, same org)

In all three cases the OA files one BTW submission per period covering ALL their sales. The inspector's detail view shows the **mix** — they see the same legal total regardless of how it was rung up, but with attribution so they understand the org's POS landscape during compliance reviews.

This is intentional future-proofing — as more Surinamese retailers adopt mixed-POS setups (e.g. a kitchen POS for restaurants + Josbin for cashier), the inspector workflow doesn't change.

---

## 21.4 Daily workflow

### Reviewing the queue

The BTW Submissions screen opens to the most recent filings across all orgs, sorted by submitted-at DESC. By default the inspector sees everything; common filters:

- **Status = filed** — the unreviewed queue (what most days look like)
- **Status = disputed** — filings still under correction
- **Period = monthly** + Year/Month range — the official filing cycle
- **Organisation** — drill into a specific taxpayer

### Per-filing actions

For each `filed` row the inspector has two buttons:

**✓ Accepteer / Accept** — formal acknowledgement.
- Optional note (e.g. *"Verified against bank statement 26-05-2026."*)
- Confirms the filing matches expectations
- Audit-logged

**⚠ Betwist / Dispute** — formal objection.
- Required reason (min 5 chars)
- Examples: *"Totals don't match bank deposit log."* / *"Missing one Z-Report period."* / *"BTW rate misapplied on category X."*
- Audit-logged
- The taxpayer's OA sees the dispute reason next time they open BTW Submissions and can resubmit a correction (see [ch 20 §20.5](20-btw-submissions-belastingdienst.md#205-resubmitting-a-correction-supersede-flow))

### When a taxpayer resubmits

The new submission shows up in the queue with the same period dates but a new reference. The superseded original is still searchable (just filter `status = superseded`) and links to its replacement.

---

## 21.5 What about their audit log?

The Audit Log nav item (in Compliance section) is the inspector's view of their OWN action trail — every accept / dispute they've done, with timestamps, IP, target filing reference. The screen scopes by `user_id = inspector.id`.

> **Why this exists:** Rekenkamer or any second-line audit of Belastingdienst itself can ask the inspector "what did you accept last quarter?" and the inspector has a clean, exportable trail.

---

## 21.6 What the inspector can NEVER see

This is worth stating clearly, especially to Org Admins who may worry about privacy:

| Data | Visibility |
|---|---|
| Product names, prices, BTW rates per product | ❌ |
| Individual sale rows, sale items, line totals | ❌ |
| Customer names, contact info, ID numbers (all WBP-S-encrypted anyway) | ❌ |
| Stock levels, stock movements | ❌ |
| Z-Reports (per-store register closes) | ❌ |
| Registers, register sessions, cashier discrepancies | ❌ |
| User lists, role lists, who's logged in | ❌ |
| API integration keys, webhooks | ❌ |
| **BTW submissions only — and only the snapshot totals, never the underlying source data** | ✅ |

The sale-IDs covered by a filing ARE stored on the submission row for Rekenkamer traceability — but the inspector role's backend policy doesn't expose a sale-detail endpoint. They can see "this filing covered N sale-IDs"; they can't look up what was on each.

A Belastingdienst auditor wanting deeper detail uses the Rekenkamer export workflow ([ch 10 §10.6](10-reports.md)) which goes through the SA/OA, not through the inspector role.

---

## 21.7 Common questions

### "Why can't I see store data? I need to verify the totals."
By design — BTW filings carry the totals the taxpayer attests to. Deeper verification is a Rekenkamer-style audit which is a different (paper-bound + signed PDF) workflow with the Org Admin's involvement, not a self-serve dashboard drill-in. Talk to the Org Admin if you need it.

### "I disputed a filing but the taxpayer hasn't resubmitted."
That's their decision to make — they may stand by the original totals. The dispute is permanent on the audit trail. You can escalate via your normal Belastingdienst process.

### "Can I see filings from organisations that have been deactivated?"
Yes — the filing row is independent of the org's active flag. If a taxpayer goes out of business mid-year, their existing filings are still inspectable.

### "I want a CSV export of all accepted filings for Q1."
Not yet — Phase 2 enhancement. For now: filter by date range + status=accepted, screenshot or copy the table. Email josbin support if you need an export pipeline added.

### "Can I see the underlying receipts behind a filing?"
No, see §21.6. If you need that, the Org Admin can generate a Rekenkamer export ([ch 10 §10.6](10-reports.md)) which is a signed PDF + CSV with the full transaction detail. Standard for tax authority deep-dives.

### "Can two tax inspectors share the same account?"
No. Each inspector should have their own account so the audit trail attributes accept/dispute actions correctly. Super Admin creates one account per inspector.

---

## 21.8 What happens if you forget your 2FA device

Standard recovery:
1. You set up 2FA on first login and **received 8 recovery codes** — use one of those to log in (single-use each).
2. If you've used all 8: the **Super Admin can reset your 2FA** via Dashboard → Users → your row → **Reset 2FA** ([ch 3 §3.10](03-users.md)). You'll be prompted to set up the QR code again.
3. After the reset, **scan the new QR**, save the new recovery codes somewhere safer than your phone (vault, printed in a sealed envelope, etc.).

---

## See also

- [Chapter 20 — BTW Submissions to Belastingdienst Suriname](20-btw-submissions-belastingdienst.md) — what the OA / SM does at the other end
- [Chapter 1 — Roles & Permissions](01-roles-and-permissions.md) — the full role matrix
- [Chapter 13 — Audit Log](13-audit-log.md) — own action trail
- [Chapter 17 — Security Policy](17-security-policy.md) — 2FA enforcement
