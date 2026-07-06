# Chapter 22 — Payment Methods, QR Wallets & Pending Payments

Josbin POS records seven payment methods. This chapter covers what an
Organisation Admin / Store Manager manages on the dashboard side: wallet QR
setup, the pending-payments queue, and where each method shows up in reports.

## 22.1 The seven payment methods

| Method | Completes at the till? | Dashboard involvement |
|---|---|---|
| 💵 Cash | ✅ | — |
| 💳 Card / PIN | ✅ | reconciliation report (per bank) |
| 🔀 Mixed | ✅ | — |
| 🏦 Bank transfer | ❌ *awaiting confirmation* | **you confirm when funds land** |
| 📱 Mobile banking | ❌ *awaiting confirmation* | **you confirm when funds land** |
| 💱 Foreign cash (USD/EUR) | ✅ | daily-rate audit trail |
| 🔳 QR wallet (Mopé / Uni5Pay+) | ✅ when the cashier confirms on the wallet device; ❌ when they can't | wallet QR setup + occasional confirmation |

## 22.2 QR wallets — one-time setup per store

Mopé and Uni5Pay+ issue your store a **static merchant QR** (sticker / PDF).
Upload it once and the POS shows it full-screen during every QR payment, with
the amount due next to it:

1. **Stores → (store) → Settings → QR wallets (Mopé / Uni5Pay+)**
2. Upload the QR image per wallet (PNG/JPG — the image your bank sent you)
3. Done — cashiers see it immediately; replace or remove it here any time

> The QR identifies your *store*, not the transaction — the customer always
> types the amount in their wallet app. The POS repeats the exact total next
> to the QR so nothing gets mistyped.

Store Managers can do this for their own store; Organisation Admins for any.

## 22.3 Pending payments — confirming transfers and delayed QR payments

**Dashboard → Pending payments** lists every sale still *awaiting
confirmation*: bank transfers, mobile-banking transfers, and QR-wallet sales
where the cashier couldn't verify the wallet notification at the till
(labelled 🔳 QR wallet).

For each row you see the provider, the customer's payment reference, the
payer name (transfers) and the amount. When the money is visible on your bank
statement or wallet merchant portal, press **Confirm** — the sale is stamped
with your name and timestamp (audit-logged).

Two protections to know about:

- **Refunds are blocked** while a sale is awaiting confirmation — money never
  leaves the drawer for funds that were never confirmed in.
- Only OA-level users can confirm; cashiers cannot approve their own
  transfers (segregation of duties).

## 22.4 Where the money shows up

- **Reports → payment-method breakdown** — all seven methods, shown when used
  (including negative totals in refund-heavy periods, so the breakdown always
  sums to the total).
- **Reports → reconciliation** — card and transfer/wallet rows grouped per
  bank / provider, for matching against bank settlement statements and wallet
  merchant portals.
- **Z-Reports** — each day's close now persists all seven method totals and
  submits them to headquarters with the sync.

> **Daily habit for QR wallets:** compare the Z-Report's QR-wallet total with
> the wallet's own merchant portal. Per-sale transaction IDs make one-by-one
> matching possible.

## 22.5 Card machines (PIN terminals)

Card payments run on the bank's **standalone PIN terminal** next to the till
— the cashier keys in the amount, the customer pays on the bank device, and
the POS records the sale (plus optional slip details for reconciliation).
There is deliberately **no direct cable between POS and terminal** yet: that
requires the acquiring bank's ECR terminal protocol, which no Surinamese bank
exposes publicly today. The POS has the integration slot ready (including a
simulated terminal mode for demos and training — see POS manual §5.3); when
your bank offers ECR integration, contact ITSea to activate it.

## 22.6 Deep dive

Developers and trainers: the full flow document — including delayed
confirmation, refund rules, the external-POS API and the future PSP
integration — is at **Dev Docs → QR-wallet betalingen (flow & use cases)**.
