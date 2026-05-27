# Script 04 — Tax Inspector portal walkthrough

**Goal:** the government-facing pitch. Convince Belastingdienst Suriname or a Ministerie inspector that the portal gives them what they need (cross-org visibility, audit trail, source-POS attribution) and *nothing* they shouldn't see (no catalogue, no customer data, no sales detail beyond what's been formally filed).

**POV:** Tax Inspector (`belastingdienst@gov.sr / Inspector@2026`).

**Target length:** 4 min.

**Pre-recording checklist**

- [ ] Demo stack running.
- [ ] **Clear the tax inspector's 2FA secret** before recording (see `README.md`). Re-enable immediately after the take.
- [ ] At least 3 BTW submissions seeded across 2+ organisations and 2+ statuses (filed + accepted + disputed). Without variety the dashboard sparkline looks flat.
  - Quick way: log in as OA, file a monthly. Log in as the inspector, accept it. Repeat for a second organisation with a daily filing left in *Filed* state. Then dispute one to show that path.
- [ ] Browser locale nl-NL.

---

## Opening hook — 15 s

> "Belastingdienst Suriname today sees BTW filings the same way they did 20 years ago — on paper, in email attachments, in spreadsheets that arrive on different days from different shops. Here's what a modern tax inspector's screen could look like when every taxpayer's BTW comes through the same platform."

**On-screen caption:** "What a modern Belastingdienst inspector sees."

---

## Scene 1 — Login + landing (30 s)

| Click | Narration | Caption |
|---|---|---|
| Login page | "Inspector logs in with their government email." | |
| Type credentials | "In production this requires 2FA — non-bypassable. I've cleared it just for recording." | "2FA mandatory in production" |
| Land on **BTW Dashboard** | "Inspector lands on a BTW dashboard, not a generic POS view. The role *only* sees BTW — no catalogue, no customers, no sales detail rows." | "Inspector sees only what they need" |

---

## Scene 2 — Dashboard tour (45 s)

| Click | Narration | Caption |
|---|---|---|
| Four KPI tiles | "Four KPIs at the top — filings this period, accepted, disputed, awaiting review. So the inspector knows at a glance whether there's a queue." | |
| 30-day sparkline | "Sparkline shows filings per day over the last 30 days. Spikes flag period-end clusters — useful pattern data." | |
| Top organisations panel | "Top organisations by BTW filed. Click any to drill into their submissions." | |
| Late-filings panel | "Late filings — organisations that haven't filed their monthly yet, with the days-overdue count. Action queue, not just a number." | "Late filings → action queue" |

---

## Scene 3 — Submissions list with filters (60 s)

| Click | Narration | Caption |
|---|---|---|
| Sidebar → **BTW-aangiftes / BTW Submissions** | "Submissions list." | |
| Filter dropdown — status | "Filter by status — filed, accepted, disputed, superseded." | |
| Filter — period type | "Period type — daily or monthly." | |
| Filter — organisation | "By organisation — pick one taxpayer to drill in." | |
| Filter — date range | "Date range." | |
| Filter — **Bron / Source POS** | "And source POS — this is the future-proof bit. Some taxpayers use Josbin POS, but the system also accepts filings from third-party POS systems through our open API. Inspector can split the view by which system filed it. Native filings here, third-party there." | "Native vs third-party POS — split view" |
| Apply a filter combination | "Combine filters — give me all monthly Accepted filings from Supermarkt De Hoop from January through March." | |
| Table updates | "Table updates instantly. CSV export available." | |

---

## Scene 4 — Drill into a filing + accept / dispute (75 s)

| Click | Narration | Caption |
|---|---|---|
| Click **Bekijken / View** on a Filed row | "Open a filing." | |
| Detail screen — top section | "Reference, organisation, period, status. Submitter and submitted-at." | |
| Per-store breakdown tile | "Per-store breakdown — for chains, see which branch contributed how much." | |
| Per-payment-method tile | "Per payment method — cash, card, bank transfer, mobile transfer. Helpful when checking against bank statements." | |
| Per-BTW-rate tile | "Per BTW rate — 0 percent exempt vs the standard 10 percent. Makes it obvious if a taxpayer has misclassified something." | "Mis-classifications visible at a glance" |
| Per-source-POS tile | "And per source POS — Josbin native here, anything via API would show separately." | |
| Click **✓ Accepteer / Accept** | "Numbers check out — accept." | |
| Modal — optional note | "Optional note — *Geverifieerd tegen bankafschriften.*" | |
| Click confirm → status flips | "Accepted. Inspector id, timestamp, and note are now permanent." | |
| (Optional) Show **⚠ Betwist / Dispute** flow on another row | "On a different row — dispute. Reason is required, minimum 5 characters. Taxpayer sees the reason in their own dashboard." | "Dispute → taxpayer corrects → resubmits" |

---

## Scene 5 — Audit trail + what the inspector can't see (30 s)

| Click | Narration | Caption |
|---|---|---|
| Click **Mijn activiteit** in My Account | "Inspector's own audit log — every action they've taken, visible to them." | |
| Show entries | "Their accept, their dispute, their searches." | |
| Sidebar tour | "Sidebar — two sections, that's it. Compliance and Account. No way to reach catalogue, prices, customers, sales detail rows, or any other taxpayer data beyond formally-filed BTW totals." | "Hard-isolated at the API layer" |

---

## Closing — 25 s

> "What you're looking at is a Belastingdienst inspector who can do their job in minutes instead of days — without ever seeing a single piece of taxpayer data that isn't theirs to see. Cross-org visibility for BTW. Zero visibility for everything else. Hash-chained audit log on every action. This is the inspection experience the Belastingdienst should be having in 2026."

**Final on-screen caption:** "Built for Belastingdienst Suriname."

---

## Post-recording

- **Re-enable the tax inspector's 2FA immediately:**

  ```bash
  docker exec josbin_demo_app php artisan tinker --execute='
    $u = \App\Models\User::where("email","belastingdienst@gov.sr")->first();
    if (! $u->two_factor_secret) {
      // Force a fresh setup on next login.
      $u->save(); // policy will re-enforce
      echo "ready for re-setup\n";
    }
  '
  ```

  Or simply visit the inspector's My Account → 2FA and re-set up via authenticator.

- This script is the one most worth showing to a government client. Don't share until you've reviewed it once for nervous-tic moments.
- Title: *"Josbin POS — the Belastingdienst portal Suriname could have."*
