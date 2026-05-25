# 4 — Sale lifecycle

> 🚧 **Stub** — this chapter is planned but not written yet. Browse other chapters in the sidebar; come back when the marker is gone.

A POST /api/sales request traced from the cashier tap to the broadcast event.

## Planned scope

- Validation, DiscountRuleService, BtwCalculationService
- DB transaction: RegisterSession lookup, Sale::nextNumber advisory lock, Sale + SaleItem inserts
- Customer spend/visit-count increment
- RecordStockMovements job (now writes per-store)
- SaleCompleted broadcast over Reverb
- DetectSaleAnomaly job (AI queue, +5s delay)
- ReceiptService — PDF + ESC/POS + email HTML
- Where each piece lives in code

---

→ Back to the [overview](README.md)
