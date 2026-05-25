# HQ Admin — Dashboard First Look
**Josbin POS · Beheerportaal eerste kennismaking**

> Cloud web app at `dashboard.josbin.sr` (or your hosted URL). Use any modern browser — Chrome, Edge, Firefox.

---

## 🔑 Login / Inloggen

1. Open the dashboard URL → enter **email + password**.
2. 2FA code if required (mandatory for Super Admin + government accounts).
3. You land on a **different home depending on your role**:

| Role | Lands on | Scope |
|------|----------|-------|
| **Super Admin** | Dashboard | All organisations, all stores |
| **Organisation Admin** | Dashboard | Your organisation only |
| **Store Manager** | Dashboard | Your assigned store(s) only |
| **Auditor** | Dashboard | Read-only across allowed scope |
| **Cashier** | My Account | Own stats only — no admin nav |

Bottom-left language toggle: **NL / EN**.

---

## 🗺️ Left nav / Linkernavigatie

Legend: **SA**=Super Admin · **OA**=Org Admin · **SM**=Store Manager · **AU**=Auditor

| Item | Visible | Purpose |
|------|---------|---------|
| **My Account / Mijn Profiel** | All | Own stats, password, 2FA |
| **Dashboard** | SA/OA/SM/AU | Live multi-store overview |
| **Z-Reports / Z-Rapporten** | SA/OA/SM/AU | End-of-day closures |
| **Reports / Rapporten** | SA/OA/SM/AU | BTW, Rekenkamer, sales |
| **Catalogue / Catalogus** | SA/OA/SM | Product master list |
| **Import / Export** | SA/OA | Bulk CSV catalogue load |
| **Registers / Kassabeheer** | SA/OA/SM | Tills, approve reopens |
| **Customers / Klanten** | SA/OA/SM | Customer database |
| **Stock / Voorraad** | SA/OA/SM | Inventory counts |
| **Price Overrides / Prijsoverschrijvingen** | SA/OA | Per-store price variations |
| **Discount Rules / Kortingsregels** | SA/OA/SM | Rules engine |
| **Comparison / Vergelijking** | SA/OA | Store-vs-store performance |
| **AI Insights / AI-inzichten** | SA/OA/SM | Weekly summary, anomalies |
| **Store Settings / Vestigingsinstellingen** | SA/OA/SM | Per-store config |
| **Organisations / Organisaties** | SA | Tenant management |
| **Users / Gebruikers** | SA/OA/SM | Accounts + roles |
| **API Keys / API-sleutels** | SA/OA | Integration keys |
| **Audit Log / Auditlogboek** | SA/OA/AU | Immutable admin trail |
| **Licenses / Licenties** | SA | Installations + expiry |

---

## 🏪 Dashboard overview — your home

```
  KPI ROW: Revenue today · Txns · BTW · Stores online
  ─────────────────────────────────────────────
  Org tabs (if you manage more than one)
  ─────────────────────────────────────────────
   ┌────────┐ ┌────────┐ ┌────────┐
   │ Store  │ │ Store  │ │ Store  │   live cards
   │ Revenue│ │ Revenue│ │ Revenue│
   │ Txn/Avg│ │ Txn/Avg│ │ Txn/Avg│
   │ ⭐ top  │ │ ⭐ top  │ │ ⭐ top  │
   │ ● On   │ │ ● On   │ │ ● Off  │
   └────────┘ └────────┘ └────────┘
```

Each card: today's SRD revenue, txn count, avg basket, BTW, top product ⭐, online dot, sync badge. Updates live via WebSocket — no refresh. Green **Live** pill in topbar = realtime connected.

---

## 📊 Drill down / Inzoomen

**Click any store card** → Store Detail (today's transactions, payment breakdown). **Click a sale row** → full sale: line items, BTW per line, cashier, exchange rate, AST timestamp. **← Back / Terug** (top-left) returns to overview.

---

## 📅 Reports / Rapporten

Left nav → **Reports**. Tabs: **Daily** · **Monthly** · **Custom range** · **BTW** (Belastingdienst format) · **Rekenkamer** (signed audit PDF for Court of Audit) · **Top products**. Every report has **Export PDF** + **Export CSV** top-right. Headers follow the NL/EN toggle.

---

## ⚙️ Settings, security, license

- **Users:** left nav → **Users / Gebruikers** — add/disable, assign roles, force 2FA.
- **Organisations** (SA): top-level — BTW number, default locale, currency.
- **Security policy:** Organisations → your org → Security tab — session timeout, lockout, geo-alerts.
- **Store config:** **Store Settings / Vestigingsinstellingen** — receipt header/footer, default BTW.
- **Licenses** (SA): **Licenses / Licenties** — installations, expiry, terminal count.
- **My password / 2FA:** **My Account / Mijn Profiel**.

---

## 🆘 If you see this banner / Als je dit ziet…

| Banner | Meaning | Action |
|--------|---------|--------|
| 🟡 License expires in N days | ≤30 days to renewal | Contact Josbin. POS works normally. |
| 🟠 License grace period | Past expiry, 14-day grace | Renew now. POS still works. |
| 🔴 Soft lock: new sales blocked | Grace exceeded | Renew immediately. Reports/exports still accessible. |
| 🟡 "Sync pending" on a store | Z-Report not at HQ | If >30 min: manager retries from POS End of Day. |
| ⚪ Store dot grey / Offline | No ping in >2 min | Internet down at store. Local POS still sells fine. |
| ⚠️ AI Insights anomaly flag | Unusual void/discount/off-hours | Open flag, read context, follow up with manager. |

---

> **Golden rule:** the dashboard is read-mostly for HQ. Real money happens in the stores — this is where you watch, audit, and configure. When in doubt, drill into the store card and look at the actual sale.
