# FIELD RUNBOOK — fresh start → client installed → customers selling

> INTERNAL (srcExcluded; /internal/ only). The complete start-to-end
> sequence for installing Josbin POS at a client — written for a **fresh
> machine**, so it works even if the usual laptop is gone. Follow it top to
> bottom; every command is copy-paste. Companions: the client-facing
> [install guide](/docs/00-installation-and-setup) (per-store detail) and
> the [deployment playbook](/docs/14-client-deployment-playbook) (rollout
> strategy). This runbook is the operator's script that stitches them.

**The three shapes** (decided per client, same codebase):
**A. Cloud-only** — everything on a server, stores use it over the internet.
**B. Local + cloud sync** *(the real product)* — a back-office PC per store
runs the stack offline-first; the cloud runs the dashboard/licences/BTW
portal. **C. Local-only** — shape B without the cloud part.

---

## Phase 0 — Before you fly (any computer, ±2 hours)

### 0.1 Regain access (the only laptop-bound things)

1. **GitHub** — log into an account with access to
   `ITSea-Software-Solutions/josbin_pos`. New machine: create a personal
   access token (repo scope) for cloning.
2. **Server SSH** — restore the key from the password manager to `~/.ssh/`,
   `chmod 600` it. Key lost? Make a new one (`ssh-keygen -t ed25519`) and
   paste the `.pub` into `~/.ssh/authorized_keys` on the droplet via the
   **DigitalOcean web console** (panel → droplet → Console).
3. **Password manager entries you need**: droplet SSH, the internal-docs
   password, dashboard Super Admin login (+ its TOTP), and the secrets
   backup of `backend/.env` + root `.env` (HANDOVER §3 explains each).

### 0.2 Workstation bootstrap

```bash
git clone https://github.com/ITSea-Software-Solutions/josbin_pos.git
cd josbin_pos
cp deploy.env.example deploy.env        # ships the real test-droplet values
ssh root@142.93.88.143 true             # must succeed silently
./scripts/pull-backup.sh                # newest DB dump → travel with it
```

Node ≥20 and Docker Desktop on the workstation if you'll build locally.

### 0.3 Build the offline USB kit

Assume the store's internet is DOWN during install. The kit makes you
independent:

```bash
# 1. Terminal installer — pick the STANDARD store-server LAN IP first.
#    Convention: every store server we install gets 192.168.0.250, so ONE
#    exe fits every store. (The API address is baked in at build time.)
#    ESCAPE HATCH: since the runtime server-config shipped, a mis-pointed
#    till is fixable ON THE SPOT — login screen → "⚙ Server" → enter the
#    real address (e.g. 192.168.0.250:8080) → Test → Save & restart.
#    Same control for managers: Settings → System → Server address.
#    So a wrong bake is a 30-second fix, not a rebuild — but keep the
#    convention anyway; zero-touch beats one-touch.
cd frontend && npm ci
VITE_API_URL=http://192.168.0.250:8080/api \
VITE_REVERB_HOST=192.168.0.250 VITE_REVERB_PORT=6001 VITE_REVERB_SCHEME=http \
VITE_REVERB_APP_KEY=josbin_pos-key npm run build:win
# → frontend/release/ "Josbin POS Setup 1.0.0.exe" (~108 MB) → copy to USB
cd ..

# 1b. Android terminals (Posiflex RT etc.): also copy the APK to the USB.
#     Build (needs ANDROID_HOME + node22 for the Capacitor CLI):
#       npx vite build --config vite.config.ts   (same VITE_* env as above)
#       npx cap sync android && cd android && ./gradlew assembleDebug
#       → android/app/build/outputs/apk/debug/app-debug.apk
#     Or grab the current one from :8095/downloads/. On the terminal:
#     Chrome → download → allow unknown apps → ⚙ Server → sell.
#     Android hardware rule: receipt printer MUST be network-attached
#     (LAN module in the PP-9000 class printers); USB-only printers do
#     not print receipts on Android. Scanner is HID — works everywhere.

# 2. Docker images as tarballs (server PC loads these without internet)
docker compose build app
docker save -o usb/josbin-app.tar     $(docker compose images app -q)
docker save -o usb/postgres.tar       pgvector/pgvector:pg16
docker save -o usb/redis.tar          redis:7-alpine
docker save -o usb/nginx.tar          nginx:1.25-alpine

# 3. The repo itself, installable offline
git bundle create usb/josbin.bundle main

# 4. Also on the USB: Docker Desktop installer (download now), this runbook
#    + install guide printed (print from :8095), trainer cheat sheets,
#    the pulled DB dump from 0.2.
```

**Physical pack list** (playbook §3): spare USB scanner, spare thermal
printer + RJ11 drawer cable, 4G dongle (Digicel/Telesur), UPS advice,
label rolls, the USB kit ×2 (two sticks — sticks die).

---

## Phase 1 — The cloud side (once per client)

### Option A — pilot on our existing droplet (fastest)

1. Dashboard → log in as Super Admin (password manager; TOTP required).
2. **Organisations → New**: name, type, BTW number, language. Open **Edit →
   POS payment options** if this client needs non-default wallets/banks.
3. Create the **Store(s)** and the **Organisation Admin** account.
4. **Licences** (manual ch 15–16): issue a licence matching store/terminal
   count; note the key for Phase 2.
5. Skip to Phase 2.

### Option B — client's own production server (the prod split)

On a fresh Ubuntu droplet/VM (2 vCPU/4 GB min):

```bash
ssh root@NEW_IP
apt update && apt install -y docker.io docker-compose-v2 git fail2ban
git clone https://<token>@github.com/ITSea-Software-Solutions/josbin_pos.git /var/www/html
cd /var/www/html

# Backend secrets — NEW values, never reuse the demo's
cp backend/.env.example backend/.env
# edit backend/.env: APP_ENV=production, APP_DEBUG=false, APP_URL,
#   strong DB_PASSWORD + REDIS_PASSWORD (openssl rand -base64 24),
#   EXCHANGERATE_API_KEY, MAIL_* when available
# Pin compose interpolation (the Redis-"secret" lesson — never skip):
umask 077; {
  echo "APP_ENV=production"
  grep -E "^(DB_PASSWORD|DB_DATABASE|DB_USERNAME|REDIS_PASSWORD)=" backend/.env
} > .env

docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.frontends.yml up -d
docker compose ... exec app php artisan key:generate --force     # APP_KEY — back it up IMMEDIATELY
docker compose ... exec app php artisan migrate --force
docker compose ... exec app php artisan db:seed --class=RolesAndPermissionsSeeder --force
docker compose ... exec app php artisan db:seed --class=SuperAdminSeeder --force
docker compose ... exec app php artisan storage:link

# Backups from day one + prove them
mkdir -p /var/backups/josbin/{db,base,wal} && chown -R 999:999 /var/backups/josbin/wal
( crontab -l 2>/dev/null; echo "30 3 * * * /var/www/html/scripts/backup.sh >> /var/backups/josbin/backup.log 2>&1" ) | crontab -
bash scripts/backup.sh && bash scripts/backup-restore-test.sh   # must print PASSED
```

Then from the workstation: edit `deploy.env` → `SSH_TARGET=root@NEW_IP` and
the `VITE_*` URLs → `bash scripts/deploy-server.sh` (builds + ships the
dashboard/POS-web/docs). With a domain: nginx 80/443 + Let's Encrypt, then
rebuild SPAs with the https URLs. Rotate the Super Admin seed password on
first login. Deploy the licence server, run the p95 load test
(`k6 run -e BASE=… scripts/load-test.js`) — the full checklist is
[PENDING §2](pending.html).

Continue like Option A steps 2–4 on this new dashboard.

---

## Phase 2 — The store's back-office server PC (shape B/C — the offline heart)

Windows 10/11 PC, 8 GB+ RAM, wired LAN. **Give it the standard static IP
first** (Settings → Network → Ethernet → IP assignment → Manual →
`192.168.0.250`, mask `255.255.255.0`, gateway = router) — the terminal exe
expects it.

```powershell
# 1. Docker Desktop from the USB → install → enable WSL2 when asked → reboot
# 2. In PowerShell, load the images (no internet needed):
docker load -i D:\usb\josbin-app.tar
docker load -i D:\usb\postgres.tar
docker load -i D:\usb\redis.tar
docker load -i D:\usb\nginx.tar
# 3. The code:
git clone D:\usb\josbin.bundle C:\josbin ; cd C:\josbin
```

4. `backend\.env` from `.env.example`, minimum to touch:
   `APP_ENV=production`, `APP_DEBUG=false`, strong `DB_PASSWORD` +
   `REDIS_PASSWORD`, and — no internet at the till is fine —
   `EXCHANGERATE_API_KEY` empty + `EXCHANGE_STATIC_RATE` set (the daily-rate
   self-heal then keeps the POS sellable). Root `.env` pin exactly as in
   Phase 1B. Then:

```powershell
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.frontends.yml up -d
docker compose ... exec app php artisan key:generate --force   # back up this APP_KEY too
docker compose ... exec app php artisan migrate --force
docker compose ... exec app php artisan db:seed --class=RolesAndPermissionsSeeder --force
docker compose ... exec app php artisan db:seed --class=SuperAdminSeeder --force
docker compose ... exec app php artisan storage:link
curl http://localhost:8080/api/health        # → "status":"ok"
```

5. Log into the dashboard on this PC (`http://192.168.0.250:8090`) as the
   seeded admin → **rotate that password** → create the client's
   Organisation, Store, Store Manager and Cashier accounts (or restore the
   cloud-prepared data: `pg_restore` the dump from the kit).
6. **Licence**: POS/dashboard → Settings → Licence → enter the key issued in
   Phase 1. Offline grace covers 72 h if the licence server is unreachable.
7. **Sync (shape B only)**: dashboard → API keys → create the store's
   integration; put its key + the cloud URL in `backend/.env`
   (`SYNC_*` block per the install guide) — Z-reports and sales then ride
   the five-layer sync (auto → retry → Z-forced → USB export → catch-up).
8. **Backups on the store PC**: Task Scheduler → daily 03:30 →
   `wsl bash /mnt/c/josbin/scripts/backup.sh` (or Git-Bash equivalent).
   Run `scripts/backup-restore-test.sh` once now — PASSED or stop here.

## Phase 3 — Terminals (the Electron app)

Per till (Windows):

1. Run **`Josbin POS-…-Setup.exe`** from the USB.
2. First launch → login screen appears (it talks to `192.168.0.250` — if it
   says "cannot reach server", the till isn't on the LAN or the server IP
   is wrong; browser fallback meanwhile: `http://192.168.0.250:8091`).
3. Log in as the cashier → store auto-selected → **open the register**
   (opening float) → sell.
4. Settings → System → **auto-start on boot** ON. Settings → Printer:
   connection, paper width, drawer pin — then Test print + Test drawer.
5. Built the exe with a different IP than the store uses? Rebuild on ANY
   machine with node: the exact command block is in Phase 0.3 — swap the IP.

### Two ways a till gets the installer

1. **From the store's own dashboard** (once the store server runs): Dashboard →
   POS app → Windows installer → Download. Works with no internet — this is the
   route the customer uses forever after go-live. Put the `.exe` in the
   server's installer dir (`JOSBIN_POS_INSTALLER_DIR`, default `downloads/`
   beside the repo) and the button appears; no restart.
2. **From our download server / the USB kit** — for the very first till, before
   the store server exists.

Either way the address is set per till (⚙ Server / 🔍 Find my server), so ONE
installer file serves every customer.

### Building & publishing an installer to the download server

The demo installer at
`http://142.93.88.143:8095/downloads/josbin-pos-demo-Setup-1.0.0.exe`
(linked from install-guide §E1) is produced like this. Repeat with a
different `VITE_API_URL` to make a store-specific build.

```bash
cd frontend && npm ci
# Point the build at whichever server this installer should talk to:
VITE_API_URL=http://142.93.88.143:8080/api \
VITE_REVERB_APP_KEY=josbin_pos-key npm run build:win
#   → frontend/release/"Josbin POS Setup 1.0.0.exe" (~108 MB)

# Publish it to the download folder the docs nginx serves (persistent,
# gitignored, survives doc redeploys):
scp "release/Josbin POS Setup 1.0.0.exe" \
    root@142.93.88.143:/var/www/html/downloads/josbin-pos-demo-Setup-1.0.0.exe
```

Notes: builds from **macOS work** (no wine needed — electron-builder
downloads its own NSIS). The build is **unsigned** → Windows SmartScreen
warns "unknown publisher" until the code-signing cert lands (PENDING §1).
The `/downloads/` nginx location forces `Content-Disposition: attachment`,
so the browser downloads rather than trying to render 108 MB.

## Phase 4 — Hardware & payments (one device at a time)

Work through install-guide **Part F** (F0 compatibility matrix → F5):
printer → drawer → scanner on real shelf products → **labelling scale
verified against THEIR scale** (silent mis-pricing risk otherwise) →
wallet QRs uploaded per store (dashboard → Store → QR wallets) → card
terminal mode = standalone (simulated mode for training) — visual guide:
`/card-payments.html`.

## Phase 5 — Data, training, go-live

1. **Catalogue**: dashboard → Import (their Excel/CSV → the importer),
   per-store prices/stock, BTW rates + exempt flags spot-checked.
2. **Daily rate** present (API or static) — POS shows it.
3. **Edge-case script** (playbook Phase-2 day 3): pull the network cable
   mid-sale, kill the printer mid-receipt, two tills on the last unit,
   refund + blind return, Z-report with forced discrepancy, licence-expiry
   banner. All green or fix before training.
4. **Training**: cashiers 15 min (cheat sheet + simulated PIN terminal),
   manager (Z-report, pending payments, stock), owner (dashboard, BTW).
5. **Go-live gate — every box, in one sitting:**
   ☐ licence active ☐ today's rate locked ☐ test sale printed + emailed
   ☐ drawer pops ☐ scanner reads shelf product ☐ scale verified (if used)
   ☐ wallet QR shows on the till ☐ offline pull-the-plug test passed
   ☐ Z-report closed (+ synced, shape B) ☐ backup ran + restore drill PASSED
   ☐ every seeded/demo password rotated ☐ manager can open the docs site
6. First real customers sell while you shadow. Leave: printed sheets,
   support contacts, the escalation path (Help drawer → docs → partner →
   ITSea).

## Phase 6 — After you leave

- **The client's customers run it themselves**: cashier opens register →
  sells (manuals ch 3–5) → manager closes the day with the Z-report →
  shape B syncs to the head office automatically.
- **Monthly routine** (partner): licence renewals, `backup.log` check,
  restore drill (`scripts/backup-restore-test.sh`), Horizon page for stuck
  jobs.
- **You, remotely**: `curl …/api/health`, the internal portal for state,
  `scripts/pull-backup.sh` for an extra off-site copy after big imports.

---

## If something breaks — first three moves

1. `curl http://<server>:8080/api/health` — which check is red?
2. `docker compose ps` + `docker compose logs --tail 50 app` on the server.
3. Working-guide §6 (ops practices) + §4 (gotcha registry) — most failure
   modes we've ever hit are written down there with their fixes.
