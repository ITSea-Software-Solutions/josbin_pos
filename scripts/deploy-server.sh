#!/usr/bin/env bash
# =============================================================================
# Josbin POS — full-stack deploy (run from a WORKSTATION with node + ssh)
#
# Unlike the root-level deploy.sh (a backend-only, server-side zero-downtime
# updater), this script deploys the WHOLE stack the way it actually runs on the
# single-Droplet setup:
#   1. Builds the two SPAs locally (dashboard + POS web) with env-specific URLs
#   2. Pushes the built dist/ to the server, pulls backend code there
#   3. Runs composer install + migrations + cache rebuild on the server
#   4. Restarts queue/reverb + the two frontend nginx containers
#   5. Health-checks the API and both SPAs
#
# Config lives in deploy.env (copy from deploy.env.example). Prod = swap that file.
#
# Usage:  ./scripts/deploy-server.sh [--seed]
#   --seed   also run RolesAndPermissionsSeeder + users:backfill-spatie-roles
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠ $1${NC}"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗ $1${NC}"; exit 1; }

[ -f deploy.env ] || fail "deploy.env not found. Run: cp deploy.env.example deploy.env  (then edit)"
# shellcheck disable=SC1091
set -a; source deploy.env; set +a

SEED=false
[ "${1:-}" = "--seed" ] && SEED=true

SSH=(ssh -o BatchMode=yes "$SSH_TARGET")
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.frontends.yml"

command -v node >/dev/null || fail "node not found — needed to build the SPAs"
"${SSH[@]}" true 2>/dev/null || fail "cannot SSH to $SSH_TARGET (key-based access required)"

# ── 1. Build SPAs locally with env-specific URLs ──────────────────────────────
export VITE_API_URL VITE_POS_URL VITE_REVERB_HOST VITE_REVERB_PORT VITE_REVERB_SCHEME VITE_REVERB_APP_KEY VITE_DOCS_URL

log "Building dashboard SPA"
( cd dashboard && npm ci --silent && npx vite build ) || fail "dashboard build failed"

log "Building POS web SPA"
( cd frontend && npm ci --silent && npx vite build --config vite.config.ts ) || fail "POS web build failed"

log "Building docs site (manual + flow diagrams)"
( cd docs-site && npm ci --silent && npm run build ) || fail "docs build failed"
log "Building internal docs (password-protected /internal/)"
node scripts/build-internal-docs.mjs || fail "internal docs build failed"
# Fold the standalone diagram pages into the same web root so they are served
# at /flows.html and /architecture.html alongside the VitePress manual.
cp docs/flows.html docs/architecture.html docs/card-payments.html docs-site/.vitepress/dist/ || fail "docs asset copy failed"
# Marketing sizzle-reel + teaser + landing page (self-contained bilingual HTML)
# → /promo.html, /teaser.html, /videos.html (the one link to share with clients).
cp marketing/josbin-pos-promo.html  docs-site/.vitepress/dist/promo.html  || fail "promo copy failed"
cp marketing/josbin-pos-platform-tour.html docs-site/.vitepress/dist/tour.html || fail "tour copy failed"
cp marketing/josbin-pos-teaser.html docs-site/.vitepress/dist/teaser.html || fail "teaser copy failed"
cp marketing/videos.html            docs-site/.vitepress/dist/videos.html || fail "videos copy failed"
cp marketing/downloads.html         docs-site/.vitepress/dist/downloads.html || fail "downloads page copy failed"

# ── 2. Push code: backend via git pull on the server, dist via rsync ──────────
log "Pulling backend code on server (branch: $GIT_BRANCH)"
"${SSH[@]}" "cd '$REMOTE_DIR' && git fetch origin '$GIT_BRANCH' && git reset --hard 'origin/$GIT_BRANCH'" \
    || fail "git pull on server failed"

log "Shipping built SPAs"
rsync -az --delete -e "ssh -o BatchMode=yes" dashboard/dist/ "$SSH_TARGET:$REMOTE_DIR/dashboard/dist/"
rsync -az --delete -e "ssh -o BatchMode=yes" frontend/dist/  "$SSH_TARGET:$REMOTE_DIR/frontend/dist/"
rsync -az --delete -e "ssh -o BatchMode=yes" docs-site/.vitepress/dist/ "$SSH_TARGET:$REMOTE_DIR/docs-site/.vitepress/dist/"

# ── 3. Backend: composer, migrate, (seed), cache ──────────────────────────────
log "Composer install (production)"
"${SSH[@]}" "cd '$REMOTE_DIR' && $COMPOSE exec -T app composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader" \
    || fail "composer install failed"

log "Running migrations"
"${SSH[@]}" "cd '$REMOTE_DIR' && $COMPOSE exec -T app php artisan migrate --force" || fail "migrate failed"

if [ "$SEED" = true ]; then
    log "Seeding roles/permissions + backfilling spatie roles"
    "${SSH[@]}" "cd '$REMOTE_DIR' && $COMPOSE exec -T app php artisan db:seed --class=RolesAndPermissionsSeeder --force"
    "${SSH[@]}" "cd '$REMOTE_DIR' && $COMPOSE exec -T app php artisan users:backfill-spatie-roles"
fi

log "Rebuilding caches"
"${SSH[@]}" "cd '$REMOTE_DIR' && $COMPOSE exec -T app php artisan config:cache && $COMPOSE exec -T app php artisan route:cache && $COMPOSE exec -T app php artisan view:cache"

# ── 4. Restart workers + frontend nginx ───────────────────────────────────────
log "Restarting app (opcache full-cache mode), queue, Reverb, and frontend containers"
# Prod runs opcache.validate_timestamps=0 — new PHP code only loads on an app
# restart. Horizon runs in its own container and must be bounced separately.
"${SSH[@]}" "cd '$REMOTE_DIR' && $COMPOSE restart app horizon scheduler"
"${SSH[@]}" "cd '$REMOTE_DIR' && $COMPOSE restart reverb dashboard-web pos-web"
# docs-web may be new on first deploy — `up -d` creates it, no-op afterwards.
"${SSH[@]}" "cd '$REMOTE_DIR' && $COMPOSE up -d docs-web"

# ── 5. Health checks ──────────────────────────────────────────────────────────
log "Health checks"
host="${SSH_TARGET#*@}"
for url in "http://$host:$APP_PORT/api/health" "http://$host:8090/" "http://$host:8091/" "http://$host:8095/" "http://$host:8095/user_manual/" "http://$host:8095/flows.html"; do
    code=$("${SSH[@]}" "curl -s -o /dev/null -w '%{http_code}' --max-time 10 '$url'" || echo 000)
    [ "$code" = "200" ] && log "OK  $url" || warn "HTTP $code  $url"
done

echo ""
log "=== Deploy complete ==="
