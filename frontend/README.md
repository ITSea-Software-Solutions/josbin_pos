# Josbin POS — POS App (React 19 + Electron)

The till: product grid, cart, BTW-correct payments (7 methods incl. Mopé /
Uni5Pay+ QR wallets), receipts (thermal ESC/POS · PDF · email · WhatsApp),
register lifecycle with morning recovery, offline-first sales. Runs as a
Windows Electron app on real tills and as a plain browser app for
previews/training. Languages: Nederlands (default) · English · Sranantongo
(draft).

> Full platform README: [`../README.md`](../README.md)

## Server URLs & logins

| Environment | URL | Log in as |
|---|---|---|
| **Test droplet (browser POS)** | <http://142.93.88.143:8091> | `kassa@dehoop.sr` / `Cashier@2026` (manager: `manager@dehoop.sr` / `Manager@2026`) |
| Local dev | <http://localhost:5173> — `npm run dev` | same accounts |

The app talks to the API baked in at build time (`VITE_API_URL`, default
`http://localhost:8080/api`). Point local dev at another stack:

```bash
VITE_API_URL=http://localhost:8082/api npm run dev        # demo stack
VITE_API_URL=http://142.93.88.143:8080/api npm run dev    # droplet
```

**Runtime override — no rebuild needed:** login screen → **⚙ Server** →
enter e.g. `192.168.0.250:8080` → Test → Save & restart. Managers: Settings
→ System → Server address. This is the field-install escape hatch.

## Commands

```bash
npm run dev                 # Vite dev server on :5173
npx vitest run              # unit tests (BTW, cart, receipts, barcode, …)
npx tsc --noEmit            # typecheck
npm run build:win           # Windows Electron installer (see FIELD_RUNBOOK.md
                            #   at the repo root for the full terminal recipe)
```

Store-server terminals follow the LAN convention `192.168.0.250` — see
[`../FIELD_RUNBOOK.md`](../FIELD_RUNBOOK.md). i18n lives in `src/i18n/`
(`nl.json` · `en.json` · `srn.json`); every user-facing string goes through
`t('…')`, never hardcoded.
