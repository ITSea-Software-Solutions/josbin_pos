#!/usr/bin/env bash
# =============================================================================
# Josbin POS — pull the newest server backup to THIS machine (off-site copy)
#
# 3-2-1 rule: the server keeps the nightly dumps (copy 1, medium 1); running
# this from the office laptop gives copy 2 on medium 2 off the server. Point
# OFFSITE_CMD in scripts/backup.sh at a bucket later for the automated third.
#
# Usage:  ./scripts/pull-backup.sh            # uses deploy.env's SSH_TARGET
#         DEST=~/JosbinBackups ./scripts/pull-backup.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f deploy.env ] && { set -a; . ./deploy.env; set +a; }
SSH_TARGET="${SSH_TARGET:?SSH_TARGET not set (deploy.env)}"
DEST="${DEST:-$HOME/JosbinBackups}"
mkdir -p "$DEST"

LATEST=$(ssh -o BatchMode=yes "$SSH_TARGET" 'ls -1t /var/backups/josbin/db/josbin-*.dump | head -1')
[ -n "$LATEST" ] || { echo "No dumps on server — run scripts/backup.sh there first"; exit 1; }

scp -o BatchMode=yes "$SSH_TARGET:$LATEST" "$DEST/"
echo "Pulled $(basename "$LATEST") → $DEST/"
ls -1t "$DEST"/josbin-*.dump | tail -n +11 | xargs -r rm -f   # keep 10 locally
