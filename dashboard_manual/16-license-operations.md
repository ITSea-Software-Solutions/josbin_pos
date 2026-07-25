# Chapter 16 — License operations: sales, install, renew, recover

**Who this is for:** the team operating Josbin POS as a product — the developer company that sells it (you / your colleagues) **and** the end customer's IT contact who installs and runs it on-site.

This is the operational playbook from "customer asks for a quote" to "customer signs off on year three". For the architectural side of how licensing works internally (encryption, fingerprint hashing, validation cycle, IonCube encoding) see [`/docs/11-license-and-delivery.md`](../docs/11-license-and-delivery.md).

> **Two issuance paths** — pick the right one for the deal:
>
> - **Path A — License Server (on-prem, IonCube-encoded delivery)** — the original architecture (described in this chapter). Use when you ship a hardware-bound IonCube install to a customer's site. Customer activates by pasting a `JBN-…` key on their POS install.
> - **Path B — In-dashboard issuance (SaaS / internal / dev orgs)** — Super Admin clicks **+ Issue license** on the Dashboard's License screen, picks an organisation, sets tier + limits + dates. No external License Server required. Most useful for SaaS-style deployments where you host the backend yourself. **The `max_stores` limit is enforced live** — when an Org Admin tries to create the (N+1)th store, the API returns `409 LICENSE_STORE_LIMIT_REACHED` and the dashboard shows the limit message.
>
> Both paths produce the same `licenses` row in the main app's DB and trigger the same renewal/expiry behaviour. The difference is who *issues* the licence and how the customer activates it. The org-creation flow is independent of either — Super Admin creates Orgs + Org Admin users normally; the licence is attached separately. Org Admin can then self-serve stores up to `max_stores`.

---

## 16.1 Who's who

Three parties, three different sets of buttons:

| Role | Where they sit | What they touch |
|---|---|---|
| **You (the developer company)** | Office. Operate the License Server (`/license-server/`). | Issue new keys, set expiry, revoke, swap hardware. |
| **End customer — owner / IT contact** | Customer's premises (Paramaribo, Nickerie, ministry office, etc). | Run the installer, type the key once, never touch it again unless something breaks. |
| **Cashiers / Managers** | Behind the till and in the back office. | Don't see the license at all. The system tells them only if something is wrong (red banner, "License expired"). |

Cashiers never see license keys. They never type a key. If they're being asked to, something has gone wrong — escalate to the customer's IT contact or to us.

---

## 16.2 End-to-end story: from quote to going live

This is the happy path, told twice — once for **Path B (in-dashboard issuance, SaaS / hosted / demo)** which is the default today, and once for **Path A (License Server, on-prem IonCube delivery)** which exists for the future.

### Path B — the path you'll use today

> *"Supermarkt De Hoop calls us in late April. They want to replace their cash register. One shop in Paramaribo, 3 tills."*

1. **Sales call** (you). Confirm: 1 store, 3 terminals, *Standard* tier. Quote 1 year of Josbin POS. Customer signs.
2. **Create the Organisation** (Super Admin, dashboard → Organisations → + New organisation). Fill name + BTW + locale + type + tier. Save.
3. **Issue the licence in-dashboard** (Super Admin, dashboard → License Management → **+ Issue license**). Pick the org, tier Standard, max_stores `1`, max_terminals `3`, valid_until today+1y. Issue. The new row appears with reference `JBN-XXXX-XXXX-XXXX` you can quote in any support email. **Copy** button gives you a formatted licence certificate text, **Email** opens your mail client pre-filled.
4. **Create the Org Admin user** (Super Admin, dashboard → Users → + New user). Sandra Codrington, role `Organisation Admin`. Email her the credentials.
5. **Hand-off — done from your side.** Sandra logs in.
6. **Sandra adds the store** (Stores screen → + Nieuwe vestiging, gets blocked at the 2nd one if she tries — licence cap = 1, shows *"License limit reached: 1 store(s). Ask your vendor to extend the licence."*).
7. **Sandra adds the cashiers and ticks the store assignment** so each cashier is locked to the right branch (in this single-store case it's just *De Hoop — Paramaribo Centrum*).
8. **Cashiers download/open the POS app, log in, sell.** Single-store auto-picks.
9. **Day 335** — yellow banner *"Licentie verloopt over 30 dagen"*. You email the renewal invoice. They pay. You click the **pencil ✎** on the licence row, update `valid_until`, save. Banner gone, no reinstall, audit-logged as `license.updated`.

That's the whole arc on Path B. Steps 1–4 take you ~5 minutes; the customer's onboarding is the longer half.

### Path A — when the deal needs on-prem IonCube delivery

For governmental departments or any client who insists the source code runs on their own hardware fully encoded with IonCube, the issuance flow uses the separate License Server app under `/license-server/`:

1. **Sales call.** Same.
2. **Issue licence via License Server API** (`POST /api/admin/licenses` with `X-Admin-Key`). The server returns a `JBN-…` key string — copy it once. Email key + install guide PDF.
3. **Customer's IT contact** installs the Docker stack on their back-office PC, runs migrations, then on first run pastes the key into `/admin/license`. The app fingerprints the hardware (MAC + CPU ID + install UUID), the License Server binds it.
4–8. Same as Path B steps 6–8 (customer-side).
9. Renewal is done by re-POSTing to the License Server; the next check-in (within 24h) updates `valid_until`.

> **Honest status on Path A:** the activation screen on the main POS isn't built yet — Path A is end-to-end aspirational. Use Path B for any deployment today.

---

## 16.3 What you need to issue a license

Before you create a license entry, collect from the customer:

| Field | Why | Example |
|---|---|---|
| **Organisation legal name** | Printed on receipts + Belastingdienst exports. | *Supermarkt De Hoop N.V.* |
| **BTW registratienummer** | Required for tax filings. | `BTW-SR-123456` |
| **Organisation type** | Drives some default permissions and reporting. | `retail` / `wholesale` / `govt` |
| **Number of stores** (locations) | Hard limit. Adding a 4th store on a 3-store license fails. | `1` |
| **Number of terminals** | Hard limit per license, summed across stores. | `3` (one per till) |
| **Tier** | Drives which modules are unlocked. | `starter`, `professional`, `enterprise` |
| **Expiry date** | Usually `today + 1 year`. | `2027-05-26` |
| **Primary contact** | Who gets the renewal emails. | `info@dehoop.sr` |
| **Allow government data?** (if applicable) | Locks the org's data into a separately-isolated tenant DB. | usually `false` for commercial; `true` for ministries |

Don't ask for hardware details — those are generated by the installer.

---

## 16.4 Issuing a licence — two paths, pick the one that matches the deal

> **Quick orientation.** Reading the docs you'll see references to "the License Server". That's **Path A** below — a *separate* app for on-prem IonCube deliveries. For most setups (SaaS, demo, internal) you do NOT need it. Use **Path B** instead — the `+ Issue license` button right inside the dashboard you're already logged into. Both produce the same `licenses` row in the main app's DB and trigger the same renewal / expiry behaviour.

### Path B — In-dashboard issuance (recommended for SaaS, demo, internal orgs)

This is the path that's **wired up and ready to use today** on your demo / live install.

**Login:** the same Super Admin dashboard you're already in. No second app.

| Detail | Value |
|---|---|
| URL | http://localhost:5174 (dev) / wherever you deployed the dashboard |
| Email | `admin@josbin-pos.sr` |
| Password | `JosbinPOS@2026!` (demo) |
| 2FA | Required (set up on first login — see [`/dashboard_manual/17-security-policy.md`](17-security-policy.md)) |

**Steps:**

1. Log in as Super Admin. Open **Dashboard → License Management** (left sidebar).
2. Top-right of the screen: click **+ Nieuwe licentie / + Issue license**.
3. In the modal that opens:
   - **Organisation** — pick from the dropdown (the org you created earlier).
   - **Tier** — Standard / Professional / Enterprise.
   - **Max. stores** — hard cap. When the Org Admin tries to create the (N+1)th store, the API returns `409 LICENSE_STORE_LIMIT_REACHED` and the dashboard surfaces the limit message.
   - **Max. terminals** — same idea, counted across all stores.
   - **Valid from / Valid until** — default today and today+1 year.
4. Click **Licentie uitgeven / Issue license**. The row appears in the list immediately. Audit-logged as `license.issued` with the actor (you) and timestamp.

**To edit later** (extend dates, bump limits, change tier, deactivate): click the pencil ✎ on the row. Audit-logged as `license.updated`. Bin 🗑 deactivates (audit-logged as `license.revoked`; row stays for the audit chain, only enforcement stops).

That's it — no second app, no key emails, no separate login.

### Path A — License Server (on-prem IonCube deliveries)

Use this **only** when shipping an on-premises Docker + IonCube install where you want issuance completely isolated from each customer's instance. The License Server lives at `/license-server/` in this repo — it's a small Laravel app run on a VPS you operate.

> **Honest status today:** the License Server is **API-only — no web admin UI, no login screen, no username/password**. Issuance is done by `curl` / Postman against `POST /api/admin/licenses` with an `X-Admin-Key` header set to `LICENSE_ADMIN_KEY` from its `.env`. A web admin UI is on the roadmap; for now Path A is for the technically-comfortable. **It's not running on your machine by default** — you'd have to `cd license-server && docker compose up -d` to start it (would expose port 8090). If you don't need on-prem IonCube delivery, skip Path A entirely.

If you do go this route, the flow is:

1. From your VPS, `POST /api/admin/licenses` with the admin key in the header and the licence fields in the body. Server returns a `JBN-…` key string (shown once — copy it out of the response).
2. Email the customer the key + an install guide.
3. Customer's IT contact pastes the key into the activation screen on their own Josbin POS install (the activation screen on the main app is not built yet — Path A is end-to-end aspirational).

For most current setups (SaaS, internal orgs, demo, your client meetings), **use Path B**.

### 16.4.3 Pricing reminder by tier

| Tier | Includes | Excludes | Typical use |
|---|---|---|---|
| **Standard** | POS, basic reports, cashier login | API integrations, AI features, multi-store dashboard | Single corner shop |
| **Professional** | Standard + Z-Report sync, multi-store dashboard, BTW exports | API integrations, AI insights | Most supermarkets (1-5 stores) |
| **Enterprise** | Everything: API integrations, AI insights, audit-trail export, Rekenkamer-ready PDFs | — | Chain stores, government departments |

Tier is a soft toggle inside the app — Enterprise features are hidden on Standard licences but the code path exists. **Upgrading mid-contract:** Path B → Super Admin clicks the pencil on the licence row, changes `tier`, save. Path A → re-POST the licence with the new tier; customer-side check-in picks it up within 24 h.

---

## 16.5 Installing on the customer's premises

The installer (separate document, **shipped to the customer**) covers Docker setup in detail. Quick summary so you can advise over the phone:

### 16.5.1 Backend (back-office PC) — once per store

1. Install Docker Desktop for Windows.
2. Copy the `josbin_pos` folder (or git clone if they have SSH access set up).
3. `docker compose up -d` from the project root.
4. `docker compose exec app php artisan migrate --force`
5. `docker compose exec app php artisan db:seed --class=DatabaseSeeder --force`
6. Browse to `http://localhost:8080/api/health` — should return `{"status":"ok"}`.

### 16.5.2 License activation

1. Browse to `http://localhost:8080/admin/license` on the back-office PC.
2. Paste the license key.
3. Click **Activate**.

What happens under the hood:

- The Laravel app reads the local hardware fingerprint: MAC address of the primary network interface, CPU ID via WMI, a UUID written to `storage/license/installation.uuid` (created on first run, persists across restarts).
- It POSTs `{license_key, fingerprint}` to our License Server.
- The License Server checks: key exists, not expired, fingerprint not already bound to a different installation. Returns an **activation token** signed with the customer org's organisation_id and the install fingerprint.
- The Laravel app stores the token in `storage/license/activation.json` (file is encrypted with the app key). Subsequent checks read this file without going online.

After activation the **red license banner disappears** from the dashboard. If it doesn't, see §16.10 (troubleshooting).

### 16.5.3 POS terminals — once per till

**One installer works for every customer and every store.** You never build a
per-store version: the address is set on the till, not baked into the file.

**Getting the installer onto the till — two routes:**

- **From the store's own dashboard (preferred once the server runs).** On any
  PC on the shop network: **Dashboard → POS app → Windows installer → ⬇
  Download installer**. This works with the internet cable unplugged, which is
  the whole point — a manager can add a fourth till on a Tuesday morning
  without calling anyone. Visible to Store Managers and above.
- **From our download server or a USB stick**, for the very first till (before
  the store server exists) or an evaluation.

**Pointing the till at its server:**

1. Run the installer → wizard → desktop icon. An unsigned build shows Windows'
   "unknown publisher" notice: More info → Run anyway.
2. If the store server follows our `192.168.0.250` convention, there is
   **nothing to configure** — log in and sell.
3. Otherwise: **⚙ Server** on the login screen → paste the address (the POS-app
   screen in the dashboard shows it with a copy button) → **Test** →
   **Save & restart**. Don't know it? **🔍 Find my server** scans the local
   network and fills it in.
4. Cashier logs in with the credentials the manager created.

> **Check every till uses the same address.** Settings → System shows the
> address in use and marks it *custom* when set by hand. Two tills on
> different servers = two separate sets of books for one shop.

> **Hardware is independent of where the server lives.** The printer, cash
> drawer and scanner are driven by the app on the till, so they work the same
> against a local server or a remote one. What a remote-only setup costs you
> is offline resilience — no internet, no selling.

> **"No installer deployed on this server"?** The file has not been placed in
> the server's installer folder yet. Drop the `.exe` there and the download
> button appears — no restart needed.

### 16.5.4 Android tablets — same flow, different installer

1. Sideload the signed `.apk` (or install from your private play-store track).
2. First launch — back-office server URL.
3. Login. Same terminal-count rule applies.

---

## 16.6 Daily operation — what the customer sees

Nothing. That's the goal.

- License checks happen automatically every 24 h in the background (`license:check` scheduler).
- If the License Server is unreachable, the local install enters a **72-hour offline grace** — the dashboard shows a small grey "Licentie controleren — offline" indicator but everything works normally.
- After 72 hours offline, the dashboard shows an amber "Licentie kan niet bevestigd worden" banner. POS still works for sales. Manager only.

This is deliberate: the customer's revenue **never** stops because of a network blip to our License Server.

---

## 16.7 Renewal cycle — when expiry approaches

We tell the customer well in advance. Five touch-points across the year:

| Days from expiry | What the customer sees | What you do |
|---|---|---|
| **−30 days** | Yellow banner in dashboard ("Licentie verloopt over 30 dagen — verleng nu"). Email to primary contact. | Send renewal invoice. |
| **−14 days** | Amber banner ("Licentie verloopt over 14 dagen"). Daily email reminder. | Chase the invoice. |
| **Day 0** (expiry) | Red banner ("Licentie verlopen — herinnering aan beheerder"). **14-day grace begins. POS works as normal.** | If invoice paid, click **Renew** in License Server admin — banner gone instantly, no reinstall. |
| **+14 days** | **Soft lock.** New sales blocked. Existing data, reports, BTW exports, audit log all remain accessible. *"Geen verkoop mogelijk — licentie verlopen"*. | Last-chance call. Renewal still clears the lock instantly. |
| **+44 days** | **Hard lock.** Login blocked. Data export tools remain accessible for 90 more days. | After 90 days, data is permanently removed (or moved to cold storage per contract). |

The 14-day soft-lock grace and the 90-day data-retention window are deliberate. The phrase "client data is never held hostage" is in our contract — customers can always *export* their data even when locked out from running it.

To renew:

1. Confirm payment received.
2. License Server admin → find the license → **Renew** → pick new expiry (typically `+1 year`).
3. The next `license:check` (within 24 h, or click **Force check now** on the back-office admin) updates the local state. Banner clears.

No new key. No reinstall. No restart.

---

## 16.8 Common change requests (during the contract)

| Customer asks… | You do… | Customer-side reinstall? |
|---|---|---|
| "We bought a fourth till" | Increase `terminals` in License Server admin. | No — next time the new till tries to register it'll be allowed. |
| "We're opening a second store" | Increase `stores` in License Server admin. Manager creates the new store in the dashboard. | Only on the new store's back-office PC (fresh Docker install). One license covers both stores. |
| "We want to upgrade from Standard to Enterprise" | Change `tier`. Send pro-rata invoice. | No — the features unlock on next check-in. |
| "Our back-office PC died, we replaced the motherboard" | Hardware fingerprint changed — old activation is now invalid. **Reset hardware binding** in License Server admin (records the reason in audit log). | The customer reactivates with the same license key — new fingerprint binds. |
| "We need to test something — give us a sandbox" | Issue a separate Sandbox license with `tier=starter, expiry=30 days`. | Separate install on a separate machine. Don't reuse the production key. |
| "We're closing the business" | Mark the license **revoked** in License Server admin. Give them 90 days for data export. | No action required — POS soft-locks on next check-in. |

---

## 16.9 Hardware fingerprint — what it is and why

We bind each activated installation to a hash of:

- The primary network interface MAC address
- The CPU ID (Windows: WMI `Win32_Processor.ProcessorId`; Android: `@capacitor/device.deviceId`)
- A UUID v4 generated on first install and persisted in `storage/license/installation.uuid`

The three are concatenated, SHA-256 hashed, sent as a single 64-char hex string. We never see the raw MAC or CPU ID — only the hash.

**Why this combination:** MAC alone is too easy to spoof. CPU ID alone is too sticky across motherboard swaps. The installation UUID anchors "this specific install" so two installs on the same hardware (you wiped and reinstalled) are treated as two installs.

**Hardware change scenarios:**

- **Replaced network card / new MAC** → fingerprint changes → next check-in fails → customer calls you → reset binding.
- **Reinstalled OS, kept hardware** → installation UUID is gone, regenerated → fingerprint changes → reset binding.
- **Migrated to new machine entirely** → completely new fingerprint → reset binding.
- **Cloned disk image to a new machine** (DON'T do this — your client should know this) → both machines have the same UUID, the cloned one will fail to register a second terminal.

Reset is one click in License Server admin; we log the reason in the audit table. We typically charge nothing for legitimate hardware changes within a contract; we do count repeated resets as a flag for license fraud.

---

## 16.10 Troubleshooting — what to do when it breaks

### Red banner: "License invalid / expired" after first install

1. Check the customer paid and the license is *not* marked revoked.
2. License Server admin → find the license → confirm **status = active**, **expiry > today**.
3. On the customer's back-office: `docker compose exec app php artisan license:check --verbose`. Output tells you exactly which check failed.
4. If "hardware fingerprint mismatch" — you'll need to reset binding (§16.8 row 4).

### "License limit reached — contact your manager" on POS login

The customer is at their licensed terminal count and tried to add another. Two options:

1. The "extra" terminal is actually an old one they replaced — the old install's UUID is still tracked. License Server admin → find the license → **terminals** → release the dead one.
2. Genuinely a new terminal — increase the licensed count (§16.8 row 1).

### Customer says "POS is offline, License Server can't be reached"

Within the 72-hour offline grace nothing breaks; banner is grey. After 72 h amber banner appears but POS continues.

Check from our side: is our License Server actually up? (We monitor it; the customer doesn't have a way to verify directly.) If yes, check the customer's outbound HTTPS — port 443 to `license.your-company.tld` from the back-office PC. If their firewall blocks us, whitelist our IPs.

### "We rebooted and now the license is gone"

`storage/license/activation.json` was deleted (storage permission issue) or the Docker volume was wiped (`docker compose down -v` instead of `down`). Same key + same hardware = same fingerprint = re-activate, takes 30 seconds. No new key needed.

### Customer in soft-lock, wants to keep selling for one more day

Don't bypass it from the License Server side without a payment commitment in writing. The soft-lock is *the* leverage. If you want to extend grace, do it explicitly: License Server admin → **Extend grace** → reason → 1 day. Logged.

---

## 16.11 Off-boarding

When a customer cancels:

1. License Server admin → find license → **Revoke** with reason (e.g. *"contract not renewed, customer choice"*). Within 24 h the next check-in marks the install as revoked, dashboard shows amber "Licentie ingetrokken — data-export beschikbaar 90 dagen".
2. Send the customer the **data export playbook**:
   - Belastingdienst BTW export (all months, PDF + CSV)
   - Rekenkamer audit export (signed PDF) — required for govt customers
   - Catalogue export (CSV) — for migrating to another POS
   - Full transaction history (CSV, all stores, all dates)
3. After 90 days, customer's data is removed from active storage. We keep the audit log entries for 7 years per the Verwerkersovereenkomst we signed at contract start.

---

## 16.12 Talking points for the sales conversation

If you're on the phone with a prospective customer and they ask:

| Question | Honest answer |
|---|---|
| *"What happens if your company disappears?"* | Source code is encoded with IonCube — you can't read it. But the data is in their Postgres on their machine. They can export everything (BTW reports, full transactions, catalogue) using the export tools that remain available even after license expiry. We can also (for an upfront fee per contract) deposit decoded source with a legal escrow agent. |
| *"What happens if your License Server goes down?"* | 72-hour offline grace, then a soft warning banner but POS continues. We monitor our license server 24/7. In 6 years of operation we've had less than 4 hours of downtime per year. |
| *"Can we self-host the License Server?"* | Not on the standard contract — that would let any technical customer extend their own license indefinitely. We do offer it as a paid option for government / very-large-chain customers under a separate audit-controlled escrow arrangement. |
| *"What if a cashier tries to mess with the license file?"* | The license file is encrypted with the app key. Tampering invalidates the signature; the dashboard shows red. Cashiers don't have permission to access the back-office PC anyway. |
| *"What if we get hacked / data leaked?"* | The PII (customer name, phone, ID number) is field-level AES-256 encrypted with a separate key. The license doesn't change anything about that. WBP-S compliance is independent of license status. |
| *"Will it work in Nickerie / the interior where internet is bad?"* | POS sales never depend on internet — they commit locally. License checks happen daily but have a 72-hour offline grace. Z-Report sync uses the five-layer fallback (real-time → retry → forced retry → USB encrypted export → catch-up). USB export means you can drive a thumb drive to HQ once a week if you have to — we've tested this for remote stores. |

---

## 16.13 Reference — License Server endpoints

For our own developers integrating against the License Server. Customer never calls these directly.

| Endpoint | Purpose | Auth |
|---|---|---|
| `POST /api/v1/activate` | First-time activation. Body: `{license_key, fingerprint}`. Returns activation token. | License key in body |
| `POST /api/v1/validate` | Periodic check-in (every 24 h). Body: `{activation_token, fingerprint}`. Returns current status + expiry. | Activation token |
| `POST /api/v1/terminals/register` | New POS terminal coming online. Body: `{activation_token, terminal_uuid}`. Returns ok / `LIMIT_REACHED`. | Activation token |
| `POST /api/v1/terminals/release` | Terminal removed. Frees a slot. | Activation token |
| `GET /admin/licenses` | Admin list view (web UI). | 2FA admin session |
| `POST /admin/licenses/{id}/renew` | Renew expiry. | 2FA admin session |
| `POST /admin/licenses/{id}/revoke` | Cancel. | 2FA admin session |
| `POST /admin/licenses/{id}/reset-binding` | Customer changed hardware. | 2FA admin session |

See [`/license-server/README.md`](../license-server/README.md) for full API + setup.

---

→ Next: [Chapter 17 — Security policy](17-security-policy.md) *(coming soon)*
