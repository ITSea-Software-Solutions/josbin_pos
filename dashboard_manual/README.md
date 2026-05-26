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

Each chapter covers one area of the dashboard. Read 1 → 18 if you're new to Josbin POS; or jump to the chapter you need.

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

All chapters are now written.

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
