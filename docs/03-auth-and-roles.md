# 3 — Auth & roles

> 🚧 **Stub** — this chapter is planned but not written yet. Browse other chapters in the sidebar; come back when the marker is gone.

Login, tokens, 2FA, and the 6 RBAC roles end-to-end.

## Planned scope

- Sanctum bearer flow — login → token → revalidate → refresh → logout
- 2FA setup, challenge, pre_auth_token lifecycle (Fortify under the hood)
- Role + permission matrix (super admin / org admin / store manager / cashier / auditor / api integration)
- Per-role 2FA policy (AppSetting) and how SecurityPolicyController enforces it
- Session timeout (POS 15min, Dashboard 60min) — SessionTimeout middleware
- Government-org single-device enforcement and geo-alert

---

→ Back to the [overview](README.md)
