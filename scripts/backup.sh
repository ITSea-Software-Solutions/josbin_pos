#!/usr/bin/env bash
# =============================================================================
# Josbin POS — nightly database backup (runs ON the server via cron)
#
#   03:30 AST daily:  pg_dump custom-format dump  → /var/backups/josbin/db/
#   Sundays extra  :  pg_basebackup base snapshot → /var/backups/josbin/base/
#                     (pairs with WAL archiving in docker-compose.prod.yml for
#                      point-in-time recovery to any minute)
#
# Retention: 14 daily dumps, 2 weekly base snapshots, WAL pruned to the
# oldest kept base. Everything logged to /var/backups/josbin/backup.log.
#
# Install (once):
#   crontab -e →  30 3 * * * /var/www/html/scripts/backup.sh >> /var/backups/josbin/backup.log 2>&1
#
# Restore drill (monthly, non-destructive): scripts/backup-restore-test.sh
# Second (off-site) copy: run scripts/pull-backup.sh from the office laptop,
# or point OFFSITE_CMD below at a bucket once credentials exist.
# =============================================================================
set -euo pipefail

CONTAINER="${JOSBIN_PG_CONTAINER:-josbin_pos_postgres}"
DB="${JOSBIN_PG_DB:-josbin_pos}"
DB_USER="${JOSBIN_PG_USER:-josbin_pos}"
ROOT=/var/backups/josbin
STAMP=$(date +%Y%m%d-%H%M)

mkdir -p "$ROOT/db" "$ROOT/base" "$ROOT/wal"

echo "[$(date '+%F %T')] backup start ($DB)"

# ── nightly logical dump (custom format = compressed + selective restore) ─────
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -Fc "$DB" > "$ROOT/db/josbin-$STAMP.dump"
SIZE=$(du -h "$ROOT/db/josbin-$STAMP.dump" | cut -f1)
echo "[$(date '+%F %T')] dump ok: josbin-$STAMP.dump ($SIZE)"

# keep 14 daily dumps
ls -1t "$ROOT"/db/josbin-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f

# ── weekly physical base backup (Sunday) for point-in-time recovery ──────────
if [ "$(date +%u)" = "7" ] || [ ! -e "$ROOT"/base/base-*.tar.gz ]; then
    docker exec "$CONTAINER" pg_basebackup -U "$DB_USER" -D /tmp/base -Ft -z -X none
    docker exec "$CONTAINER" sh -c 'cd /tmp/base && tar -czf - .' > "$ROOT/base/base-$STAMP.tar.gz"
    docker exec "$CONTAINER" rm -rf /tmp/base
    echo "[$(date '+%F %T')] base backup ok: base-$STAMP.tar.gz"
    # keep 2 base snapshots; prune WAL older than the oldest kept base
    ls -1t "$ROOT"/base/base-*.tar.gz | tail -n +3 | xargs -r rm -f
    OLDEST=$(ls -1t "$ROOT"/base/base-*.tar.gz | tail -1)
    [ -n "$OLDEST" ] && find "$ROOT/wal" -type f ! -newer "$OLDEST" -delete
fi

# ── optional off-site push (fill in when a bucket exists) ────────────────────
# OFFSITE_CMD example: s3cmd put "$ROOT/db/josbin-$STAMP.dump" s3://josbin-backups/db/
if [ -n "${OFFSITE_CMD:-}" ]; then
    eval "$OFFSITE_CMD" && echo "[$(date '+%F %T')] off-site copy ok"
fi

echo "[$(date '+%F %T')] backup done"
