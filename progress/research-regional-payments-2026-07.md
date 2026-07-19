# Regional payments research — Suriname + neighbours (2026-07-19)

> INTERNAL (progress/ is srcExcluded — never published). Deep-research run:
> 103 agents, 5 search angles, 15 sources fetched, every claim below survived
> 3-vote adversarial verification (refuted: 0). Primary sources: cbvs.sr,
> bnets.sr, uni5pay.sr, hakrinbank.com, Bank of Guyana, CBTT, bcb.gov.br.

## Verified findings

### Suriname (our market — validates the shipped design)

1. **SNEPS** (Centrale Bank van Suriname, since 2015) is an interbank RTGS+ACH
   rail behind internet/mobile banking — **not** a retail POS network. Standard
   transfers averaged ~1 business day in 2025.
2. **SNEPS Fast Payments phase 1 launched June 2026**: interbank transfers now
   process within one hour, business hours only. Target: 15-minute transfers
   24/7 by end-2026. Even the target is quarter-hour settlement — never
   checkout-grade. No POS/merchant/QR use case announced.
   → Our "bank transfer = awaiting confirmation" pending queue is exactly
   right, indefinitely. Recheck the 15-min rollout near each go-live.
3. **BNETS** runs domestic debit ("pinnen"): **8 member banks — DSB,
   Hakrinbank, Republic Bank (Suriname), SPSB, VCB, GODO, Finabank, Trustbank
   Amanah** — ~4,000 POS terminals, one terminal serves all members' cards,
   merchants get the terminal from their own bank. **No published ECR
   protocol, no independent PSPs, no merchant APIs on the card side.**
   → Our standalone-PIN-terminal design (no cable) is the verified national
   norm, not a simplification. Surichange and Southern Commercial Bank are
   NOT BNETS members.
4. **Uni5Pay+** (operated by UPPS = Southern Commercial Bank + SPSB + Telesur;
   acquired/settled via SCB) is the integration-ready wallet: **documented
   POS/ECR integration where the register computes the amount and shows a
   dynamic transaction QR** (Windows internet-connected registers; QR terminal
   fallback), a Payment API + hosted gateway (payment.uni5pay.sr), a
   production WooCommerce plugin, in production at EBS/SWM/Telesur.
   Settlement next business day in SRD/USD/EUR. Onboarding is partner-driven
   via SCB/UPPS (no self-serve developer portal).
   → Concrete target for our `qr_payment` PSP slot (feature-flagged webhook
   stub already exists). Action for the client: request merchant-API access
   from UPPS/SCB.
5. **UnionPay is an acquired card scheme in Suriname** (Uni5Pay+ Smart POS
   accepts UnionPay tap/chip/magstripe; UnionPay International reports DSB
   acceptance ≈ half the local POS/ATM network). The Smart POS marketing does
   not mention Visa/Mastercard; Visa/MC acquiring is only indirectly
   evidenced (Finabank/Hakrinbank merchant accounts).
6. **Mopé** (Hakrinbank): links one account per currency (SRD/USD/EUR) at any
   BNETS-affiliated bank; pay by QR scan or mobile number; remote payment
   requests via WhatsApp/SMS/Messenger; self-reported "tens of thousands of
   users, hundreds of companies". **No first-party merchant/POS API found**
   (only a third-party WHMCS gateway).
   → Static QR + cashier attestation remains the correct Mopé flow.

### Guyana (nearest expansion market)

7. National Payments System Act 2018 + Bank of Guyana PSP licensing. Licensed
   PSPs (list dated 30 Aug 2024 — may have grown): **MMG (Mobile Money
   Guyana), Caripay, Kanoo**. Wallet/QR acceptance goes through licensed
   PSPs — a regulated, integrable space. Currency GYD, English-speaking.

### Trinidad & Tobago (similar CARICOM market)

8. **LINX** national debit switch operated by Infolink (owned by Republic,
   RBC, Scotiabank, First Citizens; CBTT-licensed 2010; also runs the ACH
   since 2022). Six CBTT-registered e-money issuers as of June 2026:
   PayWise, PESH, TSTT "PAYPR", Massy "WIDiT", WamNow "WAM", Convenience Pay
   (provisional 3 Jun 2026 — register changes frequently).

### Brazil (benchmark; different universe)

9. **PIX** (Banco Central do Brasil, live Nov 2020): settles in seconds,
   24/7. All payment QRs must be EMV **BR Code** format since Oct 2020.
   Merchant charging is **Pix Cobrança** — dynamic QR / copy-paste, with a
   BCB-standardized charge API (github.com/bacen/pix-api) implemented by
   Cielo, Efi, BTG, Iugu, etc. A Brazil module = PSP PIX-API integration +
   BR Code emission — programmatic by design, plus (unverified here but
   known) NFC-e fiscal e-invoicing per state. Effectively a separate product.

## What did NOT survive verification (open items)

- **French Guiana, Curaçao, Aruba: zero surviving claims** — unassessed.
  Needs a dedicated research pass if the client targets them. (Expectation
  to verify then: French Guiana = French CB card + SEPA + French fiscal
  law; Dutch Caribbean = local switches + XCG/AWG.)
- **Cash-vs-electronic tender mix** at checkout: no usable statistics
  survived for any market.
- **VAT rates and fiscal-receipt/e-invoicing mandates** per country: not
  verified by this run — confirm with local counsel/tax authority before any
  cross-border commitment (Brazil's NFC-e is decision-critical there).
- Whether any Surinamese bank/BNETS will expose ECR to us on request, exact
  Visa/MC acquiring terms, and whether Mopé has an unpublished merchant API
  — ask Hakrinbank/UPPS directly.

## Product-fit conclusions

- The shipped 7-method model + pending-confirmation + static-QR display +
  standalone-terminal design is **verified correct for Suriname** on every
  point.
- Sale-level `payment_provider` is free-text → the ledger already ports to
  Guyana/T&T; only UI pick-lists (wallets, banks) and the wallet-QR upload
  whitelist are Suriname-hardcoded. Making those org-configurable is the
  single enabler for CARICOM expansion.
- Bank pick-list correction from finding 3 applied 2026-07-19: chips now
  match the 8 real BNETS members ("RBC" was stale — Republic Bank Suriname
  is the member; SPSB, VCB, GODO, Trustbank Amanah were missing).
- Recommended market order: Suriname (done) → Guyana (English, licensed
  PSPs, moderate lift) → T&T/Dutch Caribbean (research pass first) →
  Brazil/French Guiana (fiscal-compliance regimes; treat as separate
  products, not ports).
