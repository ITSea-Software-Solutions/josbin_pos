#!/usr/bin/env bash
# One-command start / stop / status for the full Josbin POS dev environment.
#
# Usage:
#   bash scripts/dev.sh up      # bring everything up (demo backend + POS + Dashboard + docs)
#   bash scripts/dev.sh down    # stop everything cleanly
#   bash scripts/dev.sh status  # show what's running and where
#   bash scripts/dev.sh logs    # tail the four log files
#
# Stack defaults to DEMO (8082). To target LIVE instead, set: JOSBIN_STACK=live
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STACK="${JOSBIN_STACK:-demo}"   # demo | live | sandbox

case "$STACK" in
  live)    COMPOSE_ARGS="-p josbin_pos -f docker-compose.yml";                              API_PORT=8080 ;;
  demo)    COMPOSE_ARGS="-p josbin_demo -f docker-compose.yml -f docker-compose.demo.yml";  API_PORT=8082 ;;
  sandbox) COMPOSE_ARGS="-p josbin_sandbox -f docker-compose.yml -f docker-compose.sandbox.yml"; API_PORT=8091 ;;
  *) echo "Unknown JOSBIN_STACK=$STACK (use live | demo | sandbox)"; exit 1 ;;
esac

API_URL="http://localhost:${API_PORT}/api"
POS_PORT=5173
DASH_PORT=5174
DOCS_PORT=5180
LOG_DIR="/tmp/josbin-dev"

mkdir -p "$LOG_DIR"

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
bold()  { printf '\033[1m%s\033[0m\n' "$1"; }

port_up() {
  curl -s -o /dev/null --max-time 2 -w '%{http_code}' "http://localhost:$1/" 2>/dev/null
}

start_vite() {
  # One assignment per `local` — macOS bash 3.2 + `set -u` errors on a local
  # that references another local declared in the same statement.
  local name="$1"
  local dir="$2"
  local port="$3"
  local logfile="$LOG_DIR/${name}.log"
  if [ "$(port_up "$port")" = "200" ]; then
    green "  ✓ ${name} already running on :${port}"
    return
  fi
  # docs-site is VitePress — plain `vite` serves its directory and 404s every
  # page, which is why local docs never worked before this check existed.
  local cmd="npx vite"
  [ "$name" = "docs" ] && cmd="npx vitepress dev"
  # Subshell so the cd never leaks — the script's own `bash "$0" status`
  # re-invocation breaks if the working directory has moved.
  ( cd "$dir" && VITE_API_URL="$API_URL" nohup $cmd --port "$port" --host > "$logfile" 2>&1 & )
  echo "  → ${name} starting on :${port} (log: $logfile)"
}

case "${1:-status}" in
  up)
    bold "==> bringing up $STACK stack on :${API_PORT}"
    cd "$ROOT"
    docker compose $COMPOSE_ARGS up -d
    echo
    bold "==> starting frontend dev servers"
    start_vite "pos"       "$ROOT/frontend"   "$POS_PORT"
    start_vite "dashboard" "$ROOT/dashboard"  "$DASH_PORT"
    start_vite "docs"      "$ROOT/docs-site"  "$DOCS_PORT"
    echo
    sleep 5
    bash "$0" status
    ;;

  down)
    bold "==> stopping frontend dev servers"
    for port in $POS_PORT $DASH_PORT $DOCS_PORT; do
      pid=$(lsof -ti:$port 2>/dev/null || true)
      if [ -n "$pid" ]; then
        kill "$pid" 2>/dev/null && echo "  ✓ killed dev server on :$port (pid $pid)"
      fi
    done
    echo
    bold "==> stopping $STACK Docker stack"
    cd "$ROOT"
    docker compose $COMPOSE_ARGS down
    ;;

  status)
    bold "==> Josbin POS dev environment status ($STACK)"
    echo "  Backend API     http://localhost:${API_PORT}/api/health    $(port_up $API_PORT)"
    echo "  POS app         http://localhost:${POS_PORT}/                $(port_up $POS_PORT)"
    echo "  Dashboard       http://localhost:${DASH_PORT}/                $(port_up $DASH_PORT)"
    echo "  Docs site       http://localhost:${DOCS_PORT}/                $(port_up $DOCS_PORT)"
    echo "  Architecture    http://localhost:${DOCS_PORT}/architecture.html"
    echo "  Swagger / API   http://localhost:${API_PORT}/api/v1/docs"
    echo "  Horizon (queue) http://localhost:${API_PORT}/horizon"
    echo
    echo "Demo logins:"
    echo "  Cashier      kassa@dehoop.sr     / Cashier@2026"
    echo "  Manager      manager@dehoop.sr   / Manager@2026"
    echo "  Org Admin    orgadmin@dehoop.sr  / OrgAdmin@2026"
    echo "  Super Admin  admin@josbin-pos.sr / JosbinPOS@2026!   (2FA required — scan QR on first login)"
    echo
    echo "Missing Super Admin? Run:"
    echo "  docker exec josbin_${STACK}_app php artisan db:seed --class=SuperAdminSeeder --force"
    ;;

  logs)
    bold "==> tailing dev server logs (Ctrl-C to stop)"
    tail -f "$LOG_DIR/pos.log" "$LOG_DIR/dashboard.log" "$LOG_DIR/docs.log" 2>/dev/null
    ;;

  *)
    echo "Usage: bash scripts/dev.sh [up|down|status|logs]"
    echo "Stack: JOSBIN_STACK=${STACK} (set to live|demo|sandbox to switch)"
    exit 1
    ;;
esac
