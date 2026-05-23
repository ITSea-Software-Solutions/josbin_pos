# Josbin POS — Build & Delivery Runbook

This folder holds the build/delivery tooling for shipping Josbin POS to a
client. Two things are protected before delivery: the **Laravel backend**
(IonCube-encoded) and the **Electron desktop app** (code-signed).

Neither step can run without paid credentials, so they are intentionally a
documented, manual delivery step rather than part of normal CI.

---

## 1. IonCube — backend code protection

The Laravel PHP source is encoded with IonCube so it is unreadable to humans
but still runs at full speed.

### What you need

- The **licensed IonCube Encoder for PHP 8.3** — purchase from
  <https://www.ioncube.com>. It is *not* in this repo.
- The free **IonCube Loader** is already baked into the production image
  (`docker/php/Dockerfile`) — clients need no extra setup.

### Encode

```bash
# Encoder on PATH:
scripts/encode-ioncube.sh

# …or point at it explicitly, and choose an output dir:
IONCUBE_ENCODER=/opt/ioncube/ioncube_encoder8.3 \
  scripts/encode-ioncube.sh dist/backend-encoded
```

`app/`, `database/`, `routes/`, `config/`, `bootstrap/`, `public/` are encoded.
`vendor/` is **not** — it is third-party code, restored on the client server
with `composer install --no-dev --optimize-autoloader`.

> Encoder flag names vary slightly between releases. If a flag is rejected,
> run `"$IONCUBE_ENCODER" --help` and adjust `ENCODER_FLAGS` in
> `encode-ioncube.sh`.

---

## 2. Electron desktop app — code signing

Signing config lives in `frontend/package.json` (`build` key) and
`frontend/build/entitlements.mac.plist`. Certificates are supplied at build
time via environment variables — **no secret is ever committed**.

### Icons (one-time)

electron-builder expects, and these must be added before a release build:

- `frontend/resources/icon.ico` — Windows, 256×256
- `frontend/resources/icon.icns` — macOS

### Windows

Needs an OV or EV code-signing certificate (`.pfx`).

```bash
export CSC_LINK="/secure/path/josbin-codesign.pfx"   # or a base64 string
export CSC_KEY_PASSWORD="<pfx password>"
cd frontend && npm run build:win
# → signed NSIS installer in frontend/release/
```

### macOS

Must run **on macOS**. Needs a "Developer ID Application" certificate plus an
Apple account for notarization.

```bash
export CSC_LINK="/secure/path/developer-id.p12"
export CSC_KEY_PASSWORD="<p12 password>"
export APPLE_ID="apple-account@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="<app-specific password>"
export APPLE_TEAM_ID="<10-char team id>"
cd frontend && npm run build:mac
# → signed + notarized .dmg / .zip in frontend/release/
```

Notarization (`mac.notarize: true`) and the hardened runtime are already
configured. If the signing env vars are absent, electron-builder produces an
**unsigned** build and skips notarization — useful for local testing.

---

## 3. CI

`tsc`/build/test CI runs automatically (`.github/workflows/{backend,frontend,dashboard}.yml`)
and always uses clean installs (`npm ci`, `composer install`) so platform
binaries are correct on every runner.

IonCube encoding and code signing are **not** in CI — they are run by hand at
delivery time with the credentials above.
