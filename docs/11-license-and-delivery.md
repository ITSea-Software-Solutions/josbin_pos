# 11 — License & delivery pipeline

> 🚧 **Stub** — this chapter is planned but not written yet. Browse other chapters in the sidebar; come back when the marker is gone.

How a fresh Docker image becomes an IonCube-encoded, code-signed installer your client can run.

## Planned scope

- License server (separate Laravel app at /license-server) — issue/activate/validate/renew/revoke
- Hardware fingerprint binding — MAC + CPU ID + UUID
- EnsureLicenseValid middleware — local cache + daily check + 72h grace
- Renewal timeline: 30/14 day warnings → grace → soft lock → hard lock
- IonCube encoding workflow — scripts/encode-ioncube.sh, needs paid licence at delivery
- Electron code signing — Windows certificate + macOS notarization
- Dashboard CI workflow (.github/workflows/dashboard.yml)

---

→ Back to the [overview](README.md)
