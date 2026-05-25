# 6 — Register & Z-Report

> 🚧 **Stub** — this chapter is planned but not written yet. Browse other chapters in the sidebar; come back when the marker is gone.

The cashier's open-shift → close-shift cycle and how it rolls up into the manager's end-of-day.

## Planned scope

- RegisterSession states: open → closed → reopen_requested → reopen_approved
- Open: opening_float, single-session-per-register guard, single-session-per-cashier-per-day guard
- Close: 4-step modal, expected vs counted cash, discrepancy capture
- Reopen request flow + manager approval in Dashboard
- X-Report (mid-day snapshot) vs Z-Report (end-of-day, store-level)
- Z-Report sync_status: pending → sent → failed
- Submit-to-HQ flow (POST /reports/z-report/{id}/submit + ZReportSubmitted broadcast)

---

→ Back to the [overview](README.md)
