# 2 — Data model

> 🚧 **Stub** — this chapter is planned but not written yet. Browse other chapters in the sidebar; come back when the marker is gone.

The entities Josbin POS operates on and how they relate. Read this after the architecture overview to understand what's stored where.

## Planned scope

- All 20 models with their key fields and relationships
- Organisation → Store → Register → Session → Sale hierarchy
- Centralised catalogue (Product, Category) + per-store override pattern (StoreProductOverride, ProductStock)
- Customer model and field-level encryption for WBP-S compliance
- AuditLog hash chain and how immutability is enforced
- Money / time / id conventions repeated for quick reference

---

→ Back to the [overview](README.md)
