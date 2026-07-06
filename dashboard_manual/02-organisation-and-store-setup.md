# Chapter 2 — Organisation & Store Setup

**Who needs this:** Super Admin (creating the very first record for a new client) and Organisation Admin (adding branches and registers under that org).

Every login in Josbin POS belongs to **one organisation**. Every transaction belongs to **one store under that organisation**. Every cash drawer belongs to **one register under that store**. This chapter walks through setting all three up — in the order you actually do them in real life.

---

## 2.1 What "Organisation" means in Josbin POS

In Josbin POS:

- **Organisation** = one *customer* of yours. A single legal entity. Owns its products, prices, users and audit trail. Cannot see another organisation's data, ever.
- **Store** = one *physical location* under that organisation. Has its own address, BTW receipt header, cash drawers and end-of-day Z-Report.
- **Register** = one *till position* inside a store. A drawer + a screen + a printer.

Two common shapes:

| Real-world business | How it lives in Josbin POS |
|---|---|
| Supermarket chain "Supermarkt De Hoop NV" with 4 branches | 1 Organisation, 4 Stores, ~2 Registers per store |
| Single corner shop "Toko Anand" | 1 Organisation, 1 Store, 1 Register |
| Government department with HQ + 2 satellite offices | 1 Organisation (flagged government), 3 Stores, 1 Register each |
| A holding company with two *different* trading names | 2 separate Organisations |

> **Rule of thumb:** if two businesses file separate BTW returns to Belastingdienst Suriname, they're separate Organisations. If they file as one, they're one Organisation with multiple stores.

The Organisation is also where the **master product catalogue** lives. Add a product once at HQ — every store in that organisation sees it instantly (Chapter 4).

---

## 2.2 Creating a new Organisation (Super Admin only)

Only the Super Admin role can create a new Organisation. This is the **first thing you do** for every new client.

**Path:** Dashboard → **Organisaties** / **Organisations** (left sidebar) → **+ Nieuwe organisatie** / **+ New organisation** (top-right button).

A panel opens with the following fields:

| Field | What to enter | Notes |
|---|---|---|
| **Organisatienaam / Organisation name** | Legal trading name | e.g. `Supermarkt De Hoop NV` |
| **BTW-nummer / BTW number** | The client's BTW registration number from Belastingdienst Suriname | e.g. `SR-BTW-123456789`. Optional but strongly recommended — it prints on every receipt |
| **Type** | `Detailhandel` (Retail) / `Overheid` (Government) / `Groothandel` (Wholesale) | Determines a few defaults and which icon shows in the list |
| **Taal / Language** | `Nederlands` or `English` | Default UI language for any user created in this org. Each user can still flip their own |
| **Abonnement / Subscription tier** | `Starter` / `Professional` / `Enterprise` | Determines license caps. Set this to match what was sold to the client |
| **Overheidsinstelling / Government organisation** | Checkbox | See §2.2.1 below — only tick this for actual government departments |

The Surinamese Dollar is the currency for every organisation — there is no currency selector. SRD is locked at the platform level.

Tap **Aanmaken / Create**. The new organisation appears at the top of the list with status *Actief / Active* and `0 stores`.

> **Quick tip on naming:** use the *legal* name, not the marketing one. So `Supermarkt De Hoop NV` rather than just `De Hoop`. The BTW receipt and Rekenkamer audit export both pull from this field.

### 2.2.1 What ticking "Government organisation" actually unlocks

The `is_government` flag changes platform behaviour automatically — you don't configure anything else. Once ticked:

- **2FA becomes mandatory and non-removable** for every user in this org (cashiers included)
- **Refunds above a configured SRD threshold** require dual approval (two managers)
- **Geo-alert** fires on any login from outside Suriname (alert only — does not block the login)
- **The Rekenkamer signed-PDF export** is enabled in the Audit Log screen
- **Super Admin impersonation is blocked** — you, the vendor, cannot "log in as" anyone in this org without an audit trail breach. The impersonation toggle in the org view shows 🔒 *Vergrendeld / Locked*.
- **Database isolation** — government orgs are provisioned on a separate database from commercial clients (handled at deploy time, not in this UI)

These rules are required by WBP-S (Wet Bescherming Persoonsgegevens Suriname) and the Court of Audit. See Chapter 1 §1.5 for the full breakdown.

> **Cannot undo this lightly.** Once an org is flagged government and has data in it, switching it back to commercial requires moving the data between databases. Tick it only when you're sure.

### 2.2.2 Viewing and editing an organisation later

Click any row in the Organisations list. A right-hand panel opens with two tabs:

- **Gegevens / Details** — all the fields you set above, plus the admin user account (if any), creation date, and the *Super Admin Impersonation* toggle.
- **Vestigingen / Stores** — the list of stores under this org and the **+ Vestiging toevoegen / + Add store** button.

The **Bewerken / Edit** button at the top opens the full edit form. Everything is editable except the currency (always SRD). Toggling `is_active` off deactivates the entire organisation — no user in it can log in until reactivated.

The **Push catalogus / Push catalogue** button lives on **Catalogus / Catalogue → top-right header** (not on the Organisations row). It triggers an immediate WebSocket broadcast of the current product catalogue to every connected POS terminal in this org. Use it after a bulk price change so cashiers don't have to wait for the next natural refresh. See [Chapter 4 §4.8](04-catalogue.md).

---

## 2.3 Adding stores under an Organisation

![Stores screen — read-only org header, list of stores, + New store button](screenshots/02-stores-screen-oa.png)


**The Stores screen is the OA's home for store CRUD.** Sidebar → **Vestigingen / Stores**. Visible to Super Admin and Org Admin only — Store Managers don't get this menu.

| Who sees what |
|---|
| **Super Admin** — sees an organisation dropdown at the top; pick the org first, then the stores list. Can create / rename / deactivate. Can also do this via Organisations → drill-in (the old SA-only flow still works). |
| **Org Admin** — sees a read-only header strip with their organisation name + BTW number + type + locale (managed by your Josbin POS vendor — email `support@josbin-pos.sr` to change), then the stores list. Can create / rename / deactivate stores up to the licence limit. |
| **Store Manager** — does **not** see the **Vestigingen / Stores** menu at all. Creating, renaming and deactivating stores is HQ work, and the API refuses those actions from a manager account (`StorePolicy`). What a manager *does* get is **Vestigingsinstellingen / Store Settings** for their own assigned store — see §2.3.1. |

**To add a store:**

![Add store modal — name, city, address, BTW, POS type](screenshots/02-stores-add-modal.png)

1. Sidebar → **Vestigingen / Stores**.
2. Top-right → **+ Nieuwe vestiging / + New store**.
3. The modal asks for: name, city, address, default BTW (defaults to 10), POS type (`native` for Josbin Electron / Android, `external` for an API-integrated third-party POS).
4. Click **Vestiging aanmaken / Create store**. The store appears in the list with status *Actief*.

**To edit deep settings later** (logo upload, receipt header/footer, BTW number on the receipt, live preview): sidebar → **Vestigingsinstellingen / Store Settings** → pick the store from the dropdown. The Stores screen footer prints this hint.

> **Licence limit is enforced live.** If your licence allows 1 store and you try to create the 2nd, the modal shows *"License limit reached: 1 store(s). Ask your vendor to extend the licence."* (HTTP 409 `LICENSE_STORE_LIMIT_REACHED`). The vendor bumps the limit on License Management — see [Chapter 15 §15.8](15-license-management.md#158-issuing-a-new-license-super-admin-in-dashboard-path).

> **Why the Stores screen, not Organisations?** The Org Admin owns exactly one organisation by design (if your client runs two, they get two OAs, one per org). The Organisations list view, the "+ New organisation" button and the org details editor are all Super Admin tools. OAs run the stores; the org row is managed by the vendor and is read-only.

The Add Store modal asks for:

| Field | What to enter |
|---|---|
| **Naam vestiging / Store name** | The branch's everyday name — e.g. `De Hoop — Paramaribo Centrum` or `Kantoor Nickerie` |
| **Stad / City** | e.g. `Paramaribo`, `Nieuw Nickerie`, `Albina` |
| **Adres / Address** | Street + number — e.g. `Domineestraat 12` |
| **Standaard BTW (%) / Default BTW (%)** | Defaults to `10` (current Suriname VAT). Override only if the store deals exclusively in a non-standard rate |
| **POS type** | `Josbin POS (native)` if cashiers will use the Josbin Electron app, or `External POS` if the store uses a third-party till that pushes sales over the API (Chapter 12) |

Tap **Aanmaken / Create**. The store appears in the list with status *Actief / Active*.

> **You only get a name, city, address, BTW and POS type from this quick-add panel.** Per-store receipt customisation (header, footer, BTW number, logo) lives in a separate screen — see §2.3.1 — because it has a live receipt preview and a logo upload. You can return to that any time.

### 2.3.1 Per-store receipt customisation

**Path:** Dashboard → **Vestigingsinstellingen / Store Settings** (left sidebar) → pick the store from the dropdown.

**Who can edit here:** Super Admin and Org Admin edit every field, for any store in the org. A **Store Manager** also gets this screen — for their **own assigned store only** — and can edit the operational fields: display name, city, address, receipt header/footer, BTW registration number on the receipt, the logo, and the QR-wallet images. The one exception is the **Default BTW rate**: for a manager it's greyed out with the hint *"Wordt door uw organisatie ingesteld / Set by your organisation"* — tax settings stay with the Org Admin. And it's not just a disabled input: the server strips `default_btw_rate` (plus structural fields like POS type and active status) from any save a manager sends, so it can't be bypassed by hand-crafting the request.

This screen has four sections plus a live receipt preview on the right that updates as you type.

**Vestigingsgegevens / Store Information**
- Store name, city, address
- **Standaard BTW-tarief / Default BTW rate** — used as the suggested rate when adding a new product

**Bonopmaak / Receipt Layout**
- **BTW-registratienummer / BTW registration number** — appears at the bottom of every receipt. Surinamese BTW receipts must show this for purchases the customer wants to claim back.
- **Koptekst / Header** — up to 3 lines printed at the top of every receipt. Typical use: trading name, address, phone.
  ```
  Supermarkt De Hoop
  Domineestraat 12, Paramaribo
  Tel: +597 471-000
  ```
- **Voettekst / Footer** — up to 3 lines printed at the bottom. Typical use: thank-you message, website, opening hours.

**Logo op bon / Receipt Logo**
- Upload a PNG, JPG or SVG, max 2 MB.
- Prints at the top of the thermal receipt, the emailed PDF receipt, and the email HTML receipt.
- A preview thumbnail shows immediately; **Remove** clears it.

**QR-wallets (Mopé / Uni5Pay+)**
- One tile per wallet provider: upload the store's **static merchant QR** (the sticker or PDF image your bank / wallet provider issued).
- The POS shows this QR large on screen during a QR payment, with the amount due next to it — the customer scans and types the amount in the wallet app.
- Full setup walkthrough: [Chapter 22 §22.2](22-payment-methods-and-wallets.md).

The right-hand pane shows exactly what the next printed bon will look like. Use it to check that your header doesn't overflow.

Hit **Wijzigingen opslaan / Save changes**. The header/footer is live on the next sale. The logo, if uploaded, kicks in after the upload step finishes (a tiny "Geüpload ✓ / Uploaded ✓" indicator appears next to the button).

> **Each store has its own receipt design.** Paramaribo can show one phone number, Nickerie another. The same product sold in both stores prints the same item line — only the header, footer, BTW number and logo differ.

---

## 2.4 Adding registers under a store

A register (Dutch: **kassa**) is one till position. Most small shops need just one. A busy supermarket lane might have 4-8.

> **Who-does-what reminder.** As manager (or org admin) you create the **register** here — once. After that, every cashier **opens a session** on it at the start of their shift via the POS app (Open Register screen → pick → enter opening float). You don't open the register for them; they do it themselves. See [POS User Manual — Ch.3 Your Register](../user_manual/03-register.md) for the cashier-side flow.

**Path:** Dashboard → **Kassabeheer / Registers** (left sidebar) → **Kassas beheren / Manage Registers** tab → pick the store (Super Admin only — org admins are scoped to their own org).

In the *Manage Registers* tab:

1. Type a register name in the **+ Nieuwe kassa toevoegen / + Add new register** input — e.g. `Kassa 1`, `Servicebalie`, `Tabak`.
2. Tap **Toevoegen / Add**.

The register appears in the list with an auto-assigned **number** (the small purple badge — `1`, `2`, `3`…). Cashiers see this number in the POS app when picking a register at the start of their shift.

To **rename** a register: tap the pencil icon, edit the name, tap **Opslaan / Save**. The number stays the same — it's a permanent reference for the audit log.

To **deactivate** a register: tap the red trash icon. The system will **refuse** if the register currently has an open session — close the session first (or have a manager force-close it from the Sessions tab). Deactivated registers stay in the audit log but can no longer be picked at shift start.

> **What's a "session"?** Every time a cashier opens a register, they create a new session — opening float, sales, closing count, all tied to that one shift. The **Kassasessies / Register Sessions** tab is where managers monitor open sessions and approve reopen requests. See Chapter 11 for the manager-side end-of-day flow.

---

## 2.5 Deactivating a store

Sometimes a branch closes, gets refitted, or is sold off. Don't delete it — **deactivate** it. All its historical sales, BTW reports and Rekenkamer audit data stay intact and visible to auditors. Cashiers just can't log into it anymore.

To deactivate: open the organisation → Stores tab → the store card has an *Actief / Active* badge. As of this release, deactivation is performed by an Organisation Admin or Super Admin through the same edit flow used for stores (`is_active = false`). Once flipped, no register at that store can be opened, but every report still includes its historical figures.

**Reactivating** is the same toggle in reverse — useful for seasonal stores (e.g. a market stall that only runs in December).

> **Don't hard-delete a store.** Suriname law (and the Rekenkamer) require that financial records remain accessible. Soft-deactivate, always. If a client insists on full removal, that's a vendor support ticket — not a self-service operation.

---

## 2.5a The Store Detail screen — what HQ sees per store

Clicking any store card from the **Dashboard** lands the OA / SM / SA on a single-store live dashboard — built specifically for "what's happening at this branch right now" rather than the rolled-up org view.

![Store detail — hero + 6 KPI tiles + alert strip](./screenshots/02-store-detail-hero-kpis.png)

**Top to bottom:**

1. **Hero** — store name + initials avatar, online/offline pill (real-time via Reverb), organisation + city + address, assigned manager, BTW number, register count. When the store goes offline, the hero shows the last-seen timestamp.

2. **Alert strip** *(only when something needs action)* — pending bank/mobile transfer count + total SRD (yellow), low-stock products at this store (red). When everything's healthy the strip disappears.

3. **KPI strip** — 6 tiles with left-edge accent stripes:
   - Today's revenue + ▲/▼ delta vs yesterday
   - Transactions + delta
   - Average basket size
   - BTW collected
   - Registers open right now
   - Low-stock product count

4. **Hourly bar chart + 7-day line chart** — peak-hour analysis for today, trend for the week. Useful for staffing decisions ("we always spike between 16:00 and 18:00 on Fridays — add a relief cashier").

![Store detail — charts, top products, active sessions](./screenshots/02-store-detail-charts-tables.png)

5. **Top 5 products today + Cashiers on shift** — side-by-side.
   - Top products show medals (🥇🥈🥉) with quantity + revenue.
   - Cashiers on shift list shows avatar + register name + since-when + opening float.

6. **Recent sales table** — last 10 completed sales with time, sale number, cashier, payment method pill, total. Same shape as the OA's full sales list, just trimmed.

7. **Sync footer** — sync status pill, last sync timestamp, last Z-report date.

![Store detail — recent sales + sync footer](./screenshots/02-store-detail-recent-sales.png)

The screen refreshes every 60 seconds. SaleCompleted broadcasts from the POS bump today's revenue + transaction count immediately without a refetch — when the cashier hits Voltooien, the OA viewing this screen sees the tile move within a second.

---

## 2.6 A worked example: setting up Supermarkt De Hoop end to end

Client: Supermarkt De Hoop NV. Two branches (Paramaribo Centrum and Nieuw Nickerie). 3 registers in Paramaribo, 1 in Nickerie. Sandra Codrington is the buyer at head office.

Here's the full sequence — what the **Super Admin** does, then what **Sandra (Org Admin)** does.

### Vendor side (Super Admin)

1. **Create the organisation.**
   Dashboard → Organisations → + New organisation:
   - Name: `Supermarkt De Hoop NV`
   - BTW number: `SR-BTW-123456789`
   - Type: Retail
   - Language: Nederlands
   - Tier: Professional (matches what was quoted)
   - Government: unchecked
   - Create.

2. **Issue Sandra's licence.**
   Dashboard → **License Management** → **+ Issue license** → pick `Supermarkt De Hoop NV`, tier `Professional`, max_stores `2`, max_terminals `4`, valid_from today, valid_until +1 year. Issue. *(Path B — in-dashboard. Path A via the separate License Server is for on-prem IonCube deliveries; see [Chapter 16](16-license-operations.md) §16.4.)*

3. **Create Sandra's Org Admin account** (covered in [Chapter 3](03-users.md)). She gets a welcome email with the dashboard link and her login email; the temporary password is handed over separately via the one-time green banner (see [Chapter 3 §3.2](03-users.md)).

4. Hand-off — done. Everything below is Sandra's job.

### Client side (Sandra Codrington, Org Admin)

> **Sandra's "first day" mental model** — from logging in to selling:
> ```
> Log in
>    ↓
> Vestigingen / Stores (sidebar) → read-only org header confirms she's in De Hoop
>    → + Nieuwe vestiging — add Paramaribo Centrum + Nieuw Nickerie (licence cap = 2)
>    ↓
> Vestigingsinstellingen / Store Settings (sidebar) → pick a store → upload logo,
>    fill BTW number on receipt, customise header/footer (live preview on the right)
>    ↓
> Catalogus / Catalogue (sidebar) → + Product manually, or
>    Import / Export → Download Excel template → fill → upload
>    → "📡 Push catalogue to POS" button (Catalogue header, top-right) once everything's loaded
>    ↓
> Kassabeheer / Registers (sidebar) → pick store → + Add register for each till
>    ↓
> Gebruikers / Users (sidebar) → + Add cashiers and store managers
>    → pick their one assigned store from "Toegewezen vestiging / Assigned store"
>    ↓
> Cashiers log into the POS app, single-store auto-picks, open register, sell.
> ```

5. **Log in** at the dashboard URL. Lands on Overview showing `0 stores, 0 sales today`. **No Organisations menu — that's Super-Admin-only.** The OA's home for store work is **Vestigingen / Stores** in the sidebar, with a read-only header showing the org name + BTW number + type + locale (managed by your Josbin POS vendor — email `support@josbin-pos.sr` for changes).

6. **Add the first store.**
   Dashboard → **Vestigingen / Stores** → **+ Nieuwe vestiging / + New store**:
   - Name: `De Hoop — Paramaribo Centrum`
   - City: `Paramaribo`
   - Address: `Domineestraat 12`
   - Default BTW: `10`
   - POS type: `Josbin POS (native)`
   - Create. Appears in the list as *Actief*.

7. **Customise the Paramaribo receipt.**
   Dashboard → **Vestigingsinstellingen / Store Settings** → pick `De Hoop — Paramaribo Centrum`:
   - BTW registration number: `SR-BTW-123456789`
   - Header:
     ```
     Supermarkt De Hoop
     Domineestraat 12, Paramaribo
     Tel: +597 471-000
     ```
   - Footer:
     ```
     Bedankt voor uw bezoek!
     www.dehoop.sr
     ```
   - Logo: upload `dehoop-logo.png`.
   - Save — live preview on the right reflects every change.

8. **Add the registers for Paramaribo.**
   Dashboard → **Kassabeheer / Registers** → Manage tab → store dropdown set to Paramaribo Centrum:
   - Add `Kassa 1`
   - Add `Kassa 2`
   - Add `Servicebalie`
   Three rows appear, numbered 1, 2, 3.

9. **Add the second store.**
   Back to **Vestigingen / Stores** → **+ Nieuwe vestiging / + Add store**:
   - Name: `De Hoop — Nieuw Nickerie`
   - City: `Nieuw Nickerie`
   - Address: `R.P. Bharosstraat 8`
   - Default BTW: `10`
   - POS type: `Josbin POS (native)`
   - Create.

10. **Customise the Nickerie receipt.**
    Same as step 7 but with Nickerie's address and phone number. The Nickerie store needs its own header so customers in Nickerie don't get a receipt printed with the Paramaribo phone number on it.

11. **Add the Nickerie register.**
    Registers → Manage tab → store dropdown set to Nieuw Nickerie:
    - Add `Kassa 1`.

12. **Sanity check.**
    Dashboard → **Vestigingen / Stores**. Both branches listed, both *Actief*. Registers screen, switching between the two stores, shows 3 + 1 = 4 total registers.

13. **Add cashiers and pin each one to a single store.**
    Dashboard → **Gebruikers / Users** → **+ Nieuwe gebruiker** → role `Cashier`. The **Toegewezen vestiging / Assigned store** dropdown appears below the role — pick exactly one.
    - Sharmila Jankipersad → store `De Hoop — Paramaribo Centrum`.
    - Rashied Alibaks → store `De Hoop — Nieuw Nickerie`.
    - Relief cashier who covers both shops? Create **two accounts** (one per store). One user, one store — there is no multi-store assignment and no "floating cashier" implicit grant. See [Chapter 1 §1.3 footnote ‡](01-roles-and-permissions.md) for why.

    Same picker for Store Manager: pick the one branch they actually run.

14. **Hand cashiers their POS install + credentials.**
    When Sharmila logs into the POS, her single assigned store auto-skips the picker — she lands straight on the Open Register gate at Paramaribo. If she ever tries the API for a Nickerie register, she gets `403 STORE_NOT_ASSIGNED`.

That's it — the organisation is fully set up in roughly 15 minutes. Next steps for Sandra: load the catalogue (Chapter 4 + bulk import in Chapter 5).

---

→ Next: [Chapter 3 — Users: create, edit, deactivate](03-users.md)
