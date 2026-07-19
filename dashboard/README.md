# Josbin POS — Super Admin Dashboard (React 19)

The HQ web app: live multi-store overview (Reverb WebSockets), catalogue +
stock + pricing, users & roles, licences, consolidated BTW / Rekenkamer
reporting, Z-Report sync, audit log, AI insights — plus the separate
government-styled portal for Belastingdienst tax inspectors.

> Full platform README: [`../README.md`](../README.md)

## Server URLs & logins

| Environment | URL | Log in as |
|---|---|---|
| **Test droplet** | <http://142.93.88.143:8090> | `admin@josbin-pos.sr` / `JosbinPOS@2026!` (2FA) · `orgadmin@dehoop.sr` / `OrgAdmin@2026` · `manager@dehoop.sr` / `Manager@2026` |
| **Tax-inspector portal** | <http://142.93.88.143:8090/belastingdienst> | `belastingdienst@gov.sr` / `Inspector@2026` (2FA mandatory) |
| Local dev | <http://localhost:5174> — `npm run dev` | same accounts (`/belastingdienst` works here too) |

Local dev talks to the live-stack API by default; switch stacks with
`VITE_API_URL=http://localhost:8082/api npm run dev`.

**Passkeys:** any user can register Face ID / Windows Hello / a hardware key
under My Account → Profile & password, then use **Sign in with a passkey**.
Works on `localhost` and the future HTTPS domain only — the UI hides itself
on plain-IP origins (so on the droplet today you'll see the explanation
card, not the button).

## Commands

```bash
npm run dev                 # Vite dev server on :5174
npx tsc --noEmit            # typecheck
npx vite build              # production bundle (deploy via
                            #   scripts/deploy-server.sh — never hand-copy)
```

Deploy rule that matters: the droplet SPAs are built by
[`../scripts/deploy-server.sh`](../scripts/deploy-server.sh) with the right
`VITE_*` values baked in — building locally with defaults and rsyncing by
hand ships a dashboard pointed at `localhost`.
