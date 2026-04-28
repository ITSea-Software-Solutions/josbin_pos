#!/usr/bin/env bash
# =============================================================================
# Josbin POS — Zero-downtime deployment script
# Usage: ./deploy.sh [branch]   (defaults to main)
#
# What this does:
#   1. Pulls latest code from git
#   2. Installs/updates Composer dependencies (no dev in production)
#   3. Runs pending database migrations
#   4. Clears and rebuilds all caches
#   5. Gracefully restarts queue workers (Horizon) — in-flight jobs finish first
#   6. Restarts Reverb WebSocket server
#   7. Reloads PHP-FPM without dropping existing connections
#   8. Runs a health check to confirm the deployment succeeded
#
# Zero-downtime: PHP-FPM reload keeps all existing connections alive.
# Horizon graceful stop: waits up to 60s for in-flight jobs to complete.
# =============================================================================
set -euo pipefail

BRANCH="${1:-main}"
APP_DIR="/var/www/html"
COMPOSE_FILE="$(dirname "$0")/docker-compose.yml"
LOG_FILE="/var/log/josbin_pos/deploy.log"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[$(date '+%H:%M:%S')] ✓ $1${NC}" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] ⚠ $1${NC}" | tee -a "$LOG_FILE"; }
fail() { echo -e "${RED}[$(date '+%H:%M:%S')] ✗ $1${NC}" | tee -a "$LOG_FILE"; exit 1; }

mkdir -p "$(dirname "$LOG_FILE")"
echo "=== Deployment started at $(date) ===" | tee -a "$LOG_FILE"

# ── 1. Pull latest code ───────────────────────────────────────────────────────
log "Pulling latest code from branch: $BRANCH"
cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# ── 2. Composer install ───────────────────────────────────────────────────────
log "Installing Composer dependencies (production)"
docker compose -f "$COMPOSE_FILE" exec -T app \
    composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader \
    || fail "Composer install failed"

# ── 3. Database migrations ────────────────────────────────────────────────────
log "Running pending database migrations"
docker compose -f "$COMPOSE_FILE" exec -T app \
    php artisan migrate --force --no-interaction \
    || fail "Migration failed — deployment aborted. Database unchanged."

# ── 4. Cache rebuild ──────────────────────────────────────────────────────────
log "Clearing and rebuilding caches"
docker compose -f "$COMPOSE_FILE" exec -T app php artisan config:cache
docker compose -f "$COMPOSE_FILE" exec -T app php artisan route:cache
docker compose -f "$COMPOSE_FILE" exec -T app php artisan view:cache
docker compose -f "$COMPOSE_FILE" exec -T app php artisan event:cache

# ── 5. Horizon graceful restart ───────────────────────────────────────────────
log "Gracefully restarting Horizon queue workers (in-flight jobs will complete)"
docker compose -f "$COMPOSE_FILE" exec -T app php artisan horizon:terminate
# horizon:terminate signals workers to stop after current job; Supervisor restarts Horizon
sleep 5
log "Horizon restarted"

# ── 6. Reverb restart ─────────────────────────────────────────────────────────
log "Restarting Reverb WebSocket server"
docker compose -f "$COMPOSE_FILE" restart reverb
# Brief sleep to let Reverb bind its port before clients reconnect
sleep 3

# ── 7. PHP-FPM graceful reload ───────────────────────────────────────────────
log "Reloading PHP-FPM (zero-downtime — existing connections unaffected)"
docker compose -f "$COMPOSE_FILE" exec -T app kill -USR2 1 2>/dev/null || \
    docker compose -f "$COMPOSE_FILE" exec -T app php-fpm reload 2>/dev/null || \
    warn "PHP-FPM reload signal failed — consider restarting the app container manually"

# ── 8. Health check ───────────────────────────────────────────────────────────
log "Running post-deployment health check"
sleep 5  # give PHP-FPM a moment to settle

HEALTH_URL="${APP_URL:-http://localhost:${APP_PORT:-8080}}/api/health"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    log "Health check passed (HTTP $HTTP_CODE)"
else
    fail "Health check returned HTTP $HTTP_CODE — investigate immediately! URL: $HEALTH_URL"
fi

echo ""
log "=== Deployment complete at $(date) ==="
echo ""
