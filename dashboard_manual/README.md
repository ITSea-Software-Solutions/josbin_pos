# Josbin POS — Dashboard Manual

**Version 1.0 | May 2026**

This guide is for **HQ users** of Josbin POS — the people who run the Super Admin Dashboard at `http://<your-server>:5174`. That's typically:

- The **head office** of a supermarket chain
- The **shop owner** of a single-store retail business
- The **system administrator** for a government department
- The **Belastingdienst auditor** doing a compliance review

No technical knowledge is required. The dashboard does the heavy lifting; this guide explains what to click and why.

> **Not the right manual?** Cashiers and store-floor staff should read the [POS User Manual](../user_manual/) instead.

---

## How to use this manual

Each chapter covers one area of the dashboard. Read 1 → 22 if you're new to Josbin POS; or jump to the chapter you need.

| # | Chapter | Who it's for |
|---|---------|--------------|
| 1 | [Roles & permissions — who can do what](01-roles-and-permissions.md) | Everyone setting up users |
| 2 | [Organisation & store setup](02-organisation-and-store-setup.md) | Super Admin, Org Admin |
| 3 | [Users — create, edit, deactivate](03-users.md) | Org Admin, Store Manager |
| 4 | [Product catalogue & categories](04-catalogue-and-categories.md) | Org Admin, Store Manager |
| 5 | [Bulk import (CSV / Excel)](05-bulk-import-csv-excel.md) | Org Admin |
| 6 | [Pricing & per-store overrides](06-pricing-and-per-store-overrides.md) | Org Admin |
| 7 | [Discount rules](07-discount-rules.md) | Org Admin, Store Manager |
| 8 | [Stock management](08-stock-management.md) | Org Admin, Store Manager |
| 9 | [Customers](09-customers.md) | Org Admin, Store Manager |
| **10** | **[Reports — daily, monthly, BTW, Rekenkamer](10-reports.md)** | **Everyone except Cashier** |
| **11** | **[Z-Reports & end-of-day sync](11-z-reports-and-end-of-day-sync.md)** | **Store Manager + Org Admin** |
| 12 | [API integrations & webhooks](12-api-integrations-and-webhooks.md) | Org Admin |
| 13 | [Audit log](13-audit-log.md) | Org Admin, Auditor |
| 14 | [AI insights](14-ai-insights.md) | Org Admin, Store Manager |
| 15 | [License management — UI overview](15-license-management.md) | Super Admin |
| **16** | **[License operations — sales, install, renew, recover](16-license-operations.md)** | **Vendor (you) + customer IT contact** |
| 17 | [Security policy (2FA per role)](17-security-policy.md) | Super Admin |
| 18 | [My Account — your profile, password, performance](18-my-account.md) | Everyone |
| 19 | [Kassabeheer / Registers — physical tills, sessions, reopen flow](19-registers.md) | Manager+ |
| 20 | [BTW Submissions — formal filings to Belastingdienst Suriname](20-btw-submissions-belastingdienst.md) | OA, SM, Inspector, SA |
| 21 | [Tax Inspector role — Belastingdienst cross-org access](21-tax-inspector.md) | SA (creating), Inspector (using) |
| 22 | [Payment methods, QR wallets & pending payments](22-payment-methods-and-wallets.md) | Org Admin, Store Manager |

All chapters are now written.

---

## What you see on first login

Every role lands on the **Dashboard** home screen after logging in — except Cashiers, who only get [My Account](18-my-account.md), and the Tax Inspector, who lands on the BTW dashboard ([Chapter 21](21-tax-inspector.md)). Two cards on that home screen only appear for some people, so they're easy to miss in the chapters:

- **Platform Overview (Super Admin only).** A cross-tenant panel pinned above the per-store cards: platform-wide KPI tiles (organisations active/inactive, today's and this month's network-wide revenue and transactions, active terminals in the last 24 h), **licence-health buckets** (healthy / expiring 30d / expiring 14d / grace / soft-lock / hard-lock) with an attention counter, the number of **BTW filings awaiting inspector review**, the **next expiring licences**, and the last **Super Admin actions**. It auto-refreshes every 60 seconds. This is the vendor's pulse across all tenants — Org Admins never see it; their dashboard starts at their own stores. Follow-ups live in [Chapter 15](15-license-management.md) (licences) and [Chapter 20](20-btw-submissions-belastingdienst.md) (filings).

- **"Get started" checklist (fresh organisations).** Org Admins (and the Super Admin, who may still be setting an org up) see a first-run onboarding card while the org is empty: **Add a store → Create users → Add products → Ring a test sale**. Each step deep-links to the right screen and ticks itself off automatically as soon as the store / users / products actually exist; the card retires itself once the org is genuinely set up. **Dismiss** hides it manually — remembered per browser, so it can reappear on another PC. The steps map to [Chapter 2](02-organisation-and-store-setup.md), [Chapter 3](03-users.md) and [Chapter 4](04-catalogue-and-categories.md).

---

## Quick reference — who logs in where

| You are… | Where you log in | What you can do |
|---|---|---|
| **Cashier** | POS app on the till (`http://localhost:5173` in dev) | Sell, take payment, hold bills, view your own performance in My Account |
| **Store Manager** | Dashboard (`http://localhost:5174`) | Run your store, approve refunds, close registers, run reports |
| **Org Admin** | Dashboard | Manage stores, catalogue, users; bulk import; push catalogue to all POS terminals |
| **Super Admin** | Dashboard | Manage all organisations and licenses (vendor only) |
| **Auditor** | Dashboard | Read-only access to sales, BTW, audit log |
| **API Integration** | Machine-to-machine, no UI | Third-party POS pushes sales via `/api/v1/*` |

---

## Important terms

| Term | Meaning |
|------|---------|
| **Organisation** | A single customer of Josbin POS — for example *Supermarkt De Hoop NV*. Owns one or more stores and a master catalogue. |
| **Store** | One physical shop / branch under an organisation. Has its own till(s), cash drawer(s), stock count. |
| **Register** | A physical till at a store — one terminal + drawer + printer. A store can have many. |
| **Catalogue** | The master list of products an organisation sells. Curated centrally by HQ. |
| **BTW** | Suriname VAT (currently 10%). |
| **SRD** | Surinamese Dollar — all prices, totals, reports. |
| **Z-Report** | End-of-day store close. Locks the day's sales, syncs to HQ. |
| **Rekenkamer** | Court of Audit of Suriname — signed PDF export of full transaction history for compliance. |

---

## Need help?

Contact your Josbin POS support contact. For technical issues that need a developer, see the [Developer Documentation](../docs/) instead.
