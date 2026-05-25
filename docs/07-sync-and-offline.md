# 7 — Sync & offline resilience

> 🚧 **Stub** — this chapter is planned but not written yet. Browse other chapters in the sidebar; come back when the marker is gone.

The 5-layer fallback that keeps POS selling even when internet drops.

## Planned scope

- Layer 1 — real-time outbox queue (Horizon retries on failure)
- Layer 2 — auto-retry schedule 1m / 5m / 15m / 30m, yellow indicator
- Layer 3 — Z-Report forced retry on close
- Layer 4 — USB AES-256 encrypted export via SyncExportController
- Layer 5 — catch-up sync on internet restore, chronological order
- Mobile data fallback (4G USB dongle) for interior stores
- How sales survive: local commit first, sync is downstream

---

→ Back to the [overview](README.md)
