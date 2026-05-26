# Chapter 15 — License Management (UI overview)

**Who needs this:** Super Admin (full view of every license across every customer) and Organisation Admin (sees only their own organisation's license, can request a renewal).

**When you need it:** any time a banner appears warning that a license is approaching expiry; whenever a customer asks "how long do we have left?"; or as part of the weekly Super Admin walk-through of the platform.

**What it prevents:** the awkward Monday morning where a customer's POS goes into soft-lock at 06:00 AST and no one knew the license was due. The dashboard makes the expiry pipeline visible long before that happens.

> **This chapter is the *UI overview* — what the License screen shows and how to drive it.** The deep operational playbook (issuing keys from the License Server, hardware fingerprints, end-to-end install, troubleshooting, off-boarding, sales talking points) lives in **[Chapter 16 — License operations](16-license-operations.md)**. Cross-link them; don't duplicate. If you're looking for "what do I do when the customer's hardware died and the fingerprint changed?" — that's Chapter 16 §16.9.

> _Screenshot placeholder: `dashboard_manual/screenshots/15-license-list.png`._
> _Needs Super Admin capture — Org Admin sidebar does not expose the License Management screen; the demo Super Admin account has 2FA enforced._
---

## 15.1 The model on this screen

The License screen lists rows from the back-office `licenses` table — one row per organisation per active license.

```
ORGANISATION (e.g. Supermarkt De Hoop NV)
   │
   └── LICENSE   (tier = Standard, max_stores = 1, max_terminals = 3)
         ├── valid_from         2026-05-26
         ├── valid_until        2027-05-26   ← drives the urgency calculation
         ├── days_remaining     365          ← derived (today vs valid_until)
         ├── hardware_uuid      <sha256 hash of MAC + CPU ID + install UUID>
         ├── last_validated_at  2026-05-26 06:00:00 (AST)
         ├── grace_period_ends_at  null      ← set when in offline grace
         └── renewal_status     "active"     ← active / warning_30 / warning_14
                                              / grace / soft_lock / hard_lock
```

The dashboard turns `days_remaining` + `renewal_status` into a single **urgency** value (`ok / medium / high / critical`) which drives all the colours and which banners show. The mapping:

| Days from expiry | Status | Urgency | Banner |
|---|---|---|---|
| > 30 days | `active` | `ok` | none |
| ≤ 30 days | `warning_30` | `medium` | yellow strip |
| ≤ 14 days | `warning_14` | `high` | orange strip |
| Expired, within 14-day grace | `grace` | `critical` | red strip |
| Grace expired, soft-lock (new sales blocked) | `soft_lock` | `critical` | red strip |
| Soft-lock + 30 days, hard-lock (login blocked) | `hard_lock` | `critical` | red strip |

Cross-link: see Chapter 16 §16.7 for what the customer experiences at each step.

---

## 15.2 Opening the screen

**Path:** Dashboard → **Licentiebeheer / License Management** (left sidebar, Super Admin only).

> Org Admins see a stripped-down version under their own organisation's settings — just their one license row, the urgency badge, and the **Vernieuwen / Renew** button. They cannot see other organisations' licenses (the API filters at the query level on `organisation_id`).

The page is in four parts:

1. **Stats strip** (top) — four cards: Total / Active / Expiring (≤14d) / Critical
2. **Alert banners** — automatic red banner if any license is critical, orange banner if any is in the ≤14d window
3. **License table** — one row per organisation
4. **Expiry timeline legend** (bottom) — colour coding cheat-sheet matching the table dots

---

## 15.3 The license table — column by column

| Column | Shows | Notes |
|---|---|---|
| **Organisatie / Organisation** | Coloured initials avatar + organisation name + first 8 chars of the license UUID | Useful for matching to logs / cross-referencing in the License Server |
| **Tier** | Coloured badge: Standard (indigo), Professional (purple), Enterprise (blue) | See Chapter 16 §16.4.3 for what each tier unlocks |
| **Limieten / Limits** | `N stores` + `N terminals` | Hard caps; exceeding either is what triggers the "License limit reached" message in POS (Chapter 16 §16.8) |
| **Geldig tot / Valid until** | Expiry date in the user's locale. Red bold if in the past. | If a grace-period end date exists, shown below in red: *"Noodperiode tot DD-MM-YYYY"* |
| **Resterende dagen / Days left** | Days-remaining pill, colour-graded green → amber → orange → red → red+sign for expired | Negative number means past expiry |
| **Laatste validatie / Last validated** | When the back-office last successfully checked in with the License Server | `—` if never validated (fresh install); stale > 72h means the license is in **offline grace** — see §15.5 |
| **Status** | Either *"In behandeling / Pending"* (renewal request submitted, vendor not yet acted) OR the urgency badge | Pending overrides urgency until vendor processes the request |
| (actions) | **Vernieuwen / Renew** button when urgency ≠ `ok` and no pending request | Disappears entirely while a request is pending |

A footer line shows the total license count.

> _Screenshot placeholder: `dashboard_manual/screenshots/15-license-row-detail.png`._
> _Needs Super Admin capture — see note at the top of this chapter._
---

## 15.4 Requesting a renewal

This is the **customer-facing** action — when an Org Admin or Super Admin clicks *Vernieuwen / Renew*, they're not actually renewing the license themselves (the vendor controls that on the License Server, see Chapter 16). They're filing a **renewal request** that lands in the audit log and notifies vendor support.

**To request renewal:**

1. License Management screen → find the row → tap **Vernieuwen / Renew** (or the red equivalent if critical).
2. The Renewal Modal opens with:
   - The organisation name, tier
   - Current expiry date, store count, terminal count
   - Optional **Opmerkingen / Notes** textarea — typical content: *"Verlenging voor 12 maanden, zelfde tier. Geen wijzigingen aan aantal terminals."*
3. Tap **Aanvraag versturen / Submit request**.
4. Confirmation: *"Aanvraag ingediend — u wordt binnen 1 werkdag gecontacteerd."* The row's status changes to *"In behandeling / Pending"* and the Renew button is replaced.

Under the hood:

- An entry is written to `audit_logs` with `event = 'license_renewal_requested'`, recording who, when, the IP, and the notes.
- `licenses.renewal_status` is set to `renewal_pending`.
- Vendor support sees this in their daily Super Admin dashboard sweep and reaches out to the customer to confirm payment and process the renewal in the License Server.
- When the License Server actually issues the new expiry date, the next nightly `license:check` (or a forced check) updates `valid_until` and clears `renewal_status` — the row goes back to `ok` urgency, banners gone, no reinstall needed.

> The dashboard **never directly extends a license**. It would defeat the licensing model if any Org Admin could click their way to a free year. The Renew button is always a *request*; the actual extension is a vendor operation on the License Server.

---

## 15.5 What the indicators mean — at a glance

### Stats strip cards (top)

| Card | Number |
|---|---|
| **Totaal / Total** | Every license on the platform (including revoked) |
| **Actief / Active** | `is_active = true` |
| **Verlopen / Expiring** | Urgency = `high` (≤ 14 days) |
| **Kritiek / Critical** | Urgency = `critical` (expired, in grace, soft-lock, or hard-lock) |

### Alert banners

- **Red banner** appears if any license has `urgency = critical`. Wording: *"N licentie(s) vereisen onmiddellijke actie — verlopen of in noodperiode."*
- **Orange banner** appears if any license has `urgency = high`. Wording: *"N licentie(s) verlopen binnen 14 dagen. Verleng zo snel mogelijk."*

Both link nowhere — they're informational, the actions are on the rows.

### Expiry timeline legend (bottom)

A horizontal strip of coloured dots + labels mirroring the urgency table in §15.1. Useful for new Super Admins who want to memorise the colour code.

---

## 15.6 Hardware fingerprint reset — handled in Chapter 16

A common operational ask — *"the customer replaced their back-office PC, the activation token is now invalid"* — is **not** a dashboard action. The License screen shows the fingerprint hash (currently as part of the row's metadata; vendor can expand the row to see it) but doesn't let you reset it.

The reset happens in the **License Server admin**, not the customer-facing dashboard. See **[Chapter 16 §16.9 Hardware fingerprint](16-license-operations.md#169-hardware-fingerprint--what-it-is-and-why)** for the full playbook.

---

## 15.7 Offline-grace indicator

If the back-office hasn't been able to reach the License Server for some time, the **Laatste validatie / Last validated** column shows a stale date and the row gets a small amber dot.

| State | What the column shows |
|---|---|
| Just validated (< 24h) | Today's date, green dot in row |
| Stale 24–72h | Date 1–3 days ago, no special indicator (this is normal — checks are daily) |
| Stale > 72h | Date > 3 days ago + amber dot. Dashboard shows a *"Licentie kan niet bevestigd worden"* banner on every screen. POS still works. |

> The "72-hour offline grace" is intentional — the customer's revenue never stops because of a network blip to the vendor's License Server. See Chapter 16 §16.6 for the customer-side behaviour.

---

## 15.8 Issuing a new license (Super Admin, in-dashboard path)

Two paths exist for getting a licence into the system — both produce the same row in `licenses` and trigger the same renewal/expiry behaviour:

1. **License Server (on-prem IonCube delivery)** — the original path, described in [Chapter 16](16-license-operations.md). Use for customers receiving an on-site Docker + IonCube install.
2. **In-dashboard (SaaS / internal / dev orgs)** — Super Admin clicks the **+ Issue license** button in the top-right of this screen. No external License Server required.

**To issue a licence from the dashboard:**

1. Click **+ Nieuwe licentie / Issue license** in the page header (Super Admin only).
2. Pick the **Organisation** from the dropdown.
3. Pick the **Tier** (Standard / Professional / Enterprise).
4. Set **Max. stores** and **Max. terminals** — the store limit is enforced live: when an Org Admin tries to create the (N+1)th store, the API returns `409 LICENSE_STORE_LIMIT_REACHED` and the dashboard surfaces the message.
5. Pick **Valid from** and **Valid until** (defaults to today and today+1y).
6. Click **Licentie uitgeven / Issue license**. The row appears in the table immediately. Action audit-logged as `license.issued`.

**Per-row Edit / Deactivate (Super Admin only):**

- The pencil icon opens the same form pre-filled for editing — typically used to bump `max_stores`, extend `valid_until` (a real renewal, not just the request flow in §15.4), or change tier mid-contract.
- The bin icon **deactivates** the licence — sets `is_active=false`. The row stays in the audit chain; only the enforcement stops. Use this for cancellations / off-boarding.

> The Renew button described in §15.4 still has a place — it's for *customers* (Org Admins) to **request** a renewal that the vendor approves on the License Server. The Edit button is the vendor-side direct extension, and only Super Admin sees it.

---

## 15.9 What this screen does NOT do

To save time chasing dead ends, the License Management dashboard explicitly does **not** offer:

- **License key display** — keys are hashed at rest; nothing in the dashboard can reveal a key after issuance. Customers who lose their key can re-activate with the same key sent at install time (it's in their installer email) or contact vendor support for a re-send.
- **Hardware fingerprint reset** — vendor-only, on the License Server (Chapter 16 §16.9). The dashboard never sees raw hardware data.
- **Per-feature toggles** — features are tier-bound, not individually licensable.
- **Customer-side direct license extension** — the Renew button in §15.4 is a *request*; the actual extension happens via Super Admin Edit (§15.8) or on the License Server.

---

## 15.10 Quick reference

```
OPEN SCREEN            Dashboard → Licentiebeheer / License Management
                       (Super Admin only — Org Admins see their own row in org settings)

UNDERSTAND STATUS      Stats strip → Total / Active / Expiring / Critical
                       Table rows → urgency badge per organisation
                       Timeline legend → colour key at the bottom

REQUEST RENEWAL        Row → Vernieuwen / Renew → fill notes → Aanvraag versturen
                       Audit-logged. Status flips to "In behandeling / Pending".
                       Vendor processes in License Server (1 business day).

EXPIRY URGENCY MAP     > 30 days     → green   (ok)
                       ≤ 30 days     → yellow  (medium)
                       ≤ 14 days     → orange  (high)
                       Expired ≤ 14d → red     (critical, grace)
                       Soft-lock     → red     (critical, sales blocked)
                       Hard-lock     → red     (critical, login blocked)

OFFLINE STALE          Last validated > 72h ago → amber dot + "kan niet bevestigd" banner
                       POS keeps selling — 72h grace is intentional

REVOKE / HARDWARE      Not in dashboard — see Chapter 16 (License Server admin)
RESET / NEW KEYS       Not in dashboard — see Chapter 16
```

For everything beyond what the screen shows — issuing keys, installing on the customer's premises, what happens on day-355 vs day-0, hardware fingerprint resets, off-boarding — go to **[Chapter 16 — License operations](16-license-operations.md)**.

---

→ Next: [Chapter 16 — License operations: sales, install, renew, recover](16-license-operations.md)
