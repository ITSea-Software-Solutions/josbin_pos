# Chapter 2 — Daily Setup: Exchange Rate

**Who does this:** Store manager (or authorised staff)
**When:** Every morning before the first sale of the day

---

## Why the exchange rate matters

Josbin POS records the **USD to SRD exchange rate** on every single sale. This is required for:

- Accurate financial reporting
- BTW (tax) filings with Belastingdienst Suriname
- Rekenkamer audit exports

**You cannot process any sales until a rate exists for today.** If a cashier tries to complete a payment before the rate is set, they will see the message: *"Geen dagkoers beschikbaar. Vergrendel de wisselkoers voor vandaag."*

---

## 2.1 Opening the Exchange Rate screen

1. In the top bar, click the **Exchange Rate** button (labelled "Wisselkoers" in Dutch or "Exchange Rate" in English).
2. The Exchange Rate screen opens.

---

## 2.2 Fetching the live rate automatically

The system can fetch today's rate from the internet automatically.

1. Click the **"Get live rate"** button (Dutch: *"Haal live koers op"*).
2. The system contacts ExchangeRate-API and fills in today's USD → SRD rate.
3. The rate appears in the large display: **1 USD = SRD XX.XXXX**
4. The status changes to **"Locked"** with the time it was locked.

> **Tip:** If the fetch fails (no internet), use the manual override described below.

---

## 2.3 Setting the rate manually

If you do not have internet access, or the fetched rate does not match your agreed rate:

1. Find the **"Manual override"** (Dutch: *"Handmatige invoer"*) section.
2. Click the number field and type the rate (e.g. `36.50`).
   - Use a dot (`.`) for the decimal separator, not a comma.
   - Enter the rate as SRD per 1 USD. Example: if 1 USD = SRD 36.50, type `36.50`.
3. Click **Save** (Dutch: *"Opslaan"*).
4. The new rate appears in the large display and is marked as **"Manual"**.

> **Warning:** The manual rate applies to every sale for the entire day. Enter it carefully. Once locked, it cannot be changed without manager access.

---

## 2.4 Using the currency converter

The Exchange Rate screen also has a **quick converter** for reference:

1. Find the **converter section** (two input fields labelled USD and SRD).
2. Type a USD amount → the SRD equivalent is calculated instantly.
3. Or type an SRD amount → the USD equivalent is calculated.
4. These conversions are for reference only. They do not affect any sale.

---

## 2.5 Viewing rate history

The bottom of the Exchange Rate screen shows the last 7 days of rates:

| Column | Description |
|--------|-------------|
| Date | The date the rate was set |
| 1 USD = SRD | The rate used that day |
| Source | "Locked" (auto-fetched) or "Manual" (entered by hand) |

This history is for reference and audit purposes.

---

## 2.6 Automated rate fetching (background)

If nobody manually fetches the rate, the system tries to fetch it automatically at **06:00 AST (Atlantic Standard Time)** every morning using a scheduled background job. This means on most mornings the rate will already be set when you arrive.

You can always override it using the manual override in step 2.3.

---

## Common problems

| Problem | Solution |
|---------|----------|
| "Get live rate" button shows an error | No internet connection. Use manual override (step 2.3). |
| The rate was entered incorrectly | Use manual override to enter the correct rate. The system will use the latest entry for today. |
| A cashier says they cannot complete a sale | Check that today's exchange rate is set. If it is missing, set it now. |
