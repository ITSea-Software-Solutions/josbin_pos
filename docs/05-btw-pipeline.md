# 5 — BTW pipeline

> 🚧 **Stub** — this chapter is planned but not written yet. Browse other chapters in the sidebar; come back when the marker is gone.

The bcmath-precision tax calculation flow that makes Josbin POS Belastingdienst-compliant.

## Planned scope

- Why no floats — the 50+ unit-test scenarios that lock the math
- calculateLineItem — extracting BTW from a tax-inclusive price
- calculateCart — line totals, sale-level discounts, BTW redistribution
- BTW-exempt products (basic foods, medicine) — skipping logic
- Discount-before-BTW order required by compliance
- Multi-rate carts (10% + 0% in one sale) — breakdown reporting
- How the BTW report endpoint formats numbers for Belastingdienst Suriname

---

→ Back to the [overview](README.md)
