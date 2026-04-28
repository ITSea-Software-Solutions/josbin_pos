# Chapter 10 — Reports

**Who uses this:** Store manager, auditor
**Where:** Top bar → Reports (Dutch: *"Rapporten"*)

Reports give you insight into your store's sales performance. All amounts are in SRD (Surinamese Dollar).

---

## 10.1 Opening the Reports screen

1. In the top bar, click **Reports** (Dutch: *"Rapporten"*).
2. The Reports screen opens with four tabs at the top.

---

## 10.2 Report tabs overview

| Tab | What it shows |
|-----|--------------|
| **Daily** | Sales for one specific day |
| **Monthly** | Sales totals for an entire month |
| **Custom** | Sales for any date range you choose |
| **X-Report** | Live snapshot of today so far (no close) |

---

## 10.3 Daily report

1. Click the **Daily** tab.
2. A date picker appears. The current date is selected by default.
3. Click the date field and choose a different date if needed.
4. The report loads automatically.

**What you see:**

| Metric | Description |
|--------|-------------|
| Total sales (SRD) | All revenue for that day |
| Transaction count | Number of completed sales |
| Average basket | Average sale value |
| Total BTW | Total tax collected |
| Cash total | Revenue from cash payments |
| Card total | Revenue from card/PIN payments |

**BTW breakdown table:**

Below the summary cards, a BTW breakdown table shows:
- Tax at each rate (e.g. 10%, 0%)
- The taxable base amount
- The BTW amount at each rate

This table is formatted for Belastingdienst Suriname BTW filing.

**Top products:**

Below the BTW table, the top-selling products for that day are listed with:
- Rank (#1, #2, etc.)
- Product name
- Units sold
- Revenue in SRD

---

## 10.4 Monthly report

1. Click the **Monthly** tab.
2. A month picker appears (e.g. "April 2026").
3. Click to change the month.
4. The report loads with totals for the entire month.

The format is identical to the daily report — same summary cards, BTW breakdown, and top products — but covering the full month.

---

## 10.5 Custom range report

Use this when you need data for a specific period that does not fit daily or monthly.

1. Click the **Custom** tab.
2. A **Date from** and **Date to** field appear.
3. Click **Date from** and select the start date.
4. Click **Date to** and select the end date.
5. The report loads covering that entire range.

**Examples:**
- Last week: Date from = 7 days ago, Date to = today
- Last quarter: Date from = start of quarter, Date to = end of quarter
- A specific promotion period: e.g. 15 April to 22 April

---

## 10.6 X-Report (live snapshot)

1. Click the **X-Report** tab.
2. The report loads immediately showing today's sales **up to this moment**.
3. A yellow banner confirms this is a live snapshot: *"X-Report — [current time]"*

The X-Report **does not** close the day. You can run it as many times as you like during the day. Use it to:
- Check how the morning shift is performing
- See if a busy hour is reflected in the numbers
- Estimate end-of-day totals

---

## 10.7 Exporting a report to PDF

All report tabs (except X-Report) can be exported to PDF.

1. Select the tab and date range you want.
2. Wait for the report to load.
3. Click **Export PDF** (Dutch: *"PDF exporteren"*) in the top right of the report area.
4. A PDF opens in a new tab or downloads.

The PDF includes:
- Store name and report period
- All summary figures
- BTW breakdown table
- Top products list
- Dutch or English headings depending on active language

> **Tip for BTW filing:** Export the monthly Daily report for the filing period. The BTW breakdown table is formatted correctly for Belastingdienst Suriname.

---

## 10.8 Reading the BTW breakdown

The BTW breakdown table is important for tax compliance:

```
BTW Rate    |  Taxable base (SRD)  |  BTW amount (SRD)
────────────┼──────────────────────┼───────────────────
10%         |        SRD 2,847.27  |     SRD 284.73
BTW-exempt  |          SRD 312.00  |       SRD 0.00
────────────┼──────────────────────┼───────────────────
Total       |        SRD 3,159.27  |     SRD 284.73
```

- **10%** row — all products subject to standard BTW
- **BTW-exempt** row — basic foods, medicine, and other exempt products
- The BTW amount in the 10% row is what must be declared to Belastingdienst

---

## Common questions about reports

**Q: A day's sales look wrong. Can I correct them?**
A: Sales records are immutable for audit integrity. Contact your manager or system administrator.

**Q: Can I see individual transactions?**
A: Yes — individual transaction detail is available in the Super Admin Dashboard. Contact your manager.

**Q: The report shows SRD 0.00 for a day I know had sales.**
A: Check that you selected the correct date. Also check that the Z-Report was closed for that day. Sales recorded after midnight AST appear on the next day.

**Q: How far back does the report history go?**
A: All sales since the system was installed are available.
