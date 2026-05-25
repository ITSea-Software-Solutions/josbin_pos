# Josbin POS — Screenshot capture

Playwright-driven script that captures every documented user-flow as deterministic PNG screenshots and drops them next to the matching manual chapter.

## Why this exists

Manual screenshots rot the moment a button label or layout changes. Re-shooting by hand across 30+ chapters is a slog and never gets done. This script reproduces a clean state, walks each flow, and snapshots the screens that the manual chapters reference via `![]` markdown markers.

Re-run after a UI change → all manual images update.

## What it captures

Each test = one chapter's user-flow. Currently:

| Manual | Chapter | Screens |
|---|---|---|
| user_manual | 1 — Login | login-screen, login-filled, store-select |
| user_manual | 3 — Open register | open-register-gate, opening-float |
| user_manual | 4–5 — POS + payment | pos-screen-empty-cart, pos-screen-with-item |
| dashboard_manual | 1 — Login + overview | login-screen, overview-landing |
| dashboard_manual | 3 — Users | users-list |
| dashboard_manual | 4 — Catalogue | catalogue-list |
| docs | 0 — Install / Swagger | swagger-ui, docs-site-landing |

Add a `test('...', ...)` block in `tests/capture.spec.ts` to capture a new flow. Use `shoot(page, 'user_manual', '04-some-name')` to save to `user_manual/screenshots/04-some-name.png`.

## Run

Pre-requisites:
- Live stack up: `docker compose up -d`
- POS dev server up: `cd frontend && npm run dev`
- Dashboard dev server up: `cd dashboard && npm run dev`
- Docs site up (only if capturing docs screens): `cd docs-site && npm run dev`

One-off setup (downloads ~150 MB of headless Chromium):

```bash
cd scripts/screenshots
npm install
npm run install:browsers
```

Capture:

```bash
npm run capture
```

Output PNGs land in:

```
user_manual/screenshots/         — POS user-manual images
dashboard_manual/screenshots/    — Dashboard manual images
trainer_cheatsheets/screenshots/ — Trainer cheat-sheet images
docs/screenshots/                — Install/dev-doc images
```

The manual chapters reference these with paths like `![Open register screen](screenshots/03-open-register-gate.png)`. VitePress and any markdown viewer pick them up automatically.

## When to re-run

- After any UI change in `frontend/src/screens/` or `dashboard/src/screens/`
- Before publishing the manual to a new client
- During QA on a release branch

If a test starts failing because a button moved, fix the selector in `capture.spec.ts` — the manual itself never needs hand-editing.
