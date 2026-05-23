#!/usr/bin/env bash
#
# encode-ioncube.sh — IonCube-encode the Josbin POS Laravel backend before
# delivering it to a client.
#
# Encoded PHP is unreadable to humans but runs at full speed inside the Docker
# container, which ships the free IonCube Loader (see docker/php/Dockerfile).
#
# ─────────────────────────────────────────────────────────────────────────────
# REQUIRES the licensed IonCube Encoder for PHP 8.3. It is NOT bundled with this
# repo — obtain it from https://www.ioncube.com, then either put it on PATH or
# point the IONCUBE_ENCODER environment variable at the binary.
#
# Flag names differ slightly between encoder releases — if the encode step
# fails on an unknown option, check `"$IONCUBE_ENCODER" --help` and adjust the
# ENCODER_FLAGS array below.
# ─────────────────────────────────────────────────────────────────────────────
#
# Usage:
#   scripts/encode-ioncube.sh [output-dir]
#   IONCUBE_ENCODER=/opt/ioncube/ioncube_encoder8.3 scripts/encode-ioncube.sh
#
# Default output directory: dist/backend-encoded
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SRC="$REPO_ROOT/backend"
OUT="${1:-$REPO_ROOT/dist/backend-encoded}"
ENCODER="${IONCUBE_ENCODER:-ioncube_encoder8.3}"

# ── Pre-flight checks ───────────────────────────────────────────────────────
if ! command -v "$ENCODER" >/dev/null 2>&1; then
  echo "ERROR: IonCube encoder '$ENCODER' was not found." >&2
  echo "       Install the licensed encoder, or set IONCUBE_ENCODER to its path." >&2
  exit 1
fi

if [ ! -d "$SRC" ]; then
  echo "ERROR: backend source directory not found at $SRC" >&2
  exit 1
fi

echo "── IonCube encode ──────────────────────────────────────────"
echo "  encoder : $ENCODER  ($("$ENCODER" --version 2>/dev/null | head -n1 || echo 'version unknown'))"
echo "  source  : $SRC"
echo "  output  : $OUT"
echo

# ── Encode ──────────────────────────────────────────────────────────────────
# The encoder encodes every .php file and copies non-PHP files verbatim.
#
# vendor/ is third-party code (already licensed / open source) and is NOT
# encoded — it is restored on the client side with `composer install --no-dev`.
# storage/, tests/, node_modules/, .git/ and .env are likewise excluded.
ENCODER_FLAGS=(
  -o "$OUT"
  --php-target-version 8.3
  --ignore "vendor"
  --ignore "node_modules"
  --ignore "storage"
  --ignore "tests"
  --ignore ".git"
  --ignore ".env"
  --no-doc-comments
)

rm -rf "$OUT"
mkdir -p "$(dirname "$OUT")"

"$ENCODER" "$SRC" "${ENCODER_FLAGS[@]}"

echo
echo "✓ Encoded backend written to: $OUT"
echo
echo "Next steps for delivery:"
echo "  1. On the client server, run:  composer install --no-dev --optimize-autoloader"
echo "     (restores the un-encoded vendor/ directory)"
echo "  2. The Docker image already includes the IonCube Loader — no client setup needed."
echo "  3. Verify with:  php artisan about   (should run without IonCube errors)"
