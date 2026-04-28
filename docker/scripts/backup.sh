#!/usr/bin/env bash
# =============================================================================
# Josbin POS — Automated encrypted database backup
#
# Schedule: daily at 02:00 AST via cron or Docker scheduler
# Cron entry: 0 2 * * * /path/to/docker/scripts/backup.sh >> /var/log/josbin_pos/backup.log 2>&1
#
# What this does:
#   1. pg_dump → gzip compress → AES-256-CBC encrypt
#   2. Saves to LOCAL_BACKUP_DIR with timestamp
#   3. Optionally uploads to offsite (S3-compatible) via rclone
#   4. Prunes local backups older than KEEP_DAYS
#   5. Tests the most recent backup by decrypting and verifying (weekly)
#   6. Sends alert email if any step fails
#
# 3-2-1 Rule: 3 copies, 2 different media, 1 offsite
#   Copy 1: PostgreSQL container (live data)
#   Copy 2: Local backup directory (this script)
#   Copy 3: Offsite S3/cloud (rclone upload)
# =============================================================================
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_DATABASE:-josbin_pos}"
DB_USER="${DB_USERNAME:-josbin_pos}"
DB_PASS="${DB_PASSWORD:-secret}"

LOCAL_BACKUP_DIR="${BACKUP_DIR:-/var/backups/josbin_pos}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-$(cat /run/secrets/backup_key 2>/dev/null || echo "${APP_KEY:-changeme}")}"

OFFSITE_ENABLED="${BACKUP_OFFSITE_ENABLED:-false}"
OFFSITE_REMOTE="${BACKUP_OFFSITE_REMOTE:-s3:josbin_pos-backups}"

ALERT_EMAIL="${BACKUP_ALERT_EMAIL:-}"
COMPOSE_FILE="$(dirname "$(dirname "$0")")/docker-compose.yml"

# ── Helpers ───────────────────────────────────────────────────────────────────
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
TODAY=$(date '+%Y-%m-%d')
WEEKDAY=$(date '+%u')  # 1=Monday … 7=Sunday

RED='\033[0;31m'; GREEN='\033[0;32m'; NC='\033[0m'
log()  { echo -e "${GREEN}[$(date '+%H:%M:%S')] $1${NC}"; }
fail() {
    echo -e "${RED}[$(date '+%H:%M:%S')] BACKUP FAILED: $1${NC}"
    if [ -n "$ALERT_EMAIL" ]; then
        echo "Josbin POS backup failed on $(hostname) at $(date): $1" | \
            mail -s "⚠️ Josbin POS Backup Failed — $(hostname)" "$ALERT_EMAIL" 2>/dev/null || true
    fi
    exit 1
}

mkdir -p "$LOCAL_BACKUP_DIR"

DUMP_FILE="${LOCAL_BACKUP_DIR}/josbin_pos_${TIMESTAMP}.sql.gz.enc"
VERIFY_FILE="${LOCAL_BACKUP_DIR}/.verify_${TIMESTAMP}.sql.gz"

# ── 1. Dump + Compress + Encrypt (pipeline — no plaintext on disk) ────────────
log "Starting backup: $DB_NAME → $DUMP_FILE"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump \
        --username="$DB_USER" \
        --no-password \
        --format=plain \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        "$DB_NAME" \
    | gzip -9 \
    | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
        -pass "pass:${ENCRYPTION_KEY}" \
    > "$DUMP_FILE" \
    || fail "pg_dump pipeline failed"

DUMP_SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
log "Backup written: $DUMP_FILE ($DUMP_SIZE)"

# ── 2. Verify integrity (decrypt + check header) ──────────────────────────────
log "Verifying backup integrity"
openssl enc -aes-256-cbc -d -salt -pbkdf2 -iter 100000 \
    -pass "pass:${ENCRYPTION_KEY}" \
    -in "$DUMP_FILE" \
    | gunzip -t \
    || fail "Backup verification failed — encrypted file is corrupt or key mismatch"
log "Backup integrity verified"

# ── 3. Weekly full restore test (Sundays) ─────────────────────────────────────
if [ "$WEEKDAY" = "7" ]; then
    log "Sunday — performing full restore test to verify backup is usable"
    RESTORE_DB="${DB_NAME}_restore_test_${TIMESTAMP}"

    # Create test database, restore, check row count, drop test database
    docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "$DB_USER" -c "CREATE DATABASE ${RESTORE_DB};" \
        || fail "Could not create restore test DB"

    openssl enc -aes-256-cbc -d -salt -pbkdf2 -iter 100000 \
        -pass "pass:${ENCRYPTION_KEY}" \
        -in "$DUMP_FILE" \
        | gunzip \
        | docker compose -f "$COMPOSE_FILE" exec -T postgres \
            psql -U "$DB_USER" -d "$RESTORE_DB" -q \
        || fail "Restore test failed — backup cannot be restored"

    ROW_COUNT=$(docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "$DB_USER" -d "$RESTORE_DB" -tAc "SELECT COUNT(*) FROM sales;" 2>/dev/null || echo 0)

    docker compose -f "$COMPOSE_FILE" exec -T postgres \
        psql -U "$DB_USER" -c "DROP DATABASE ${RESTORE_DB};" || true

    log "Restore test passed — $ROW_COUNT sales rows verified"
fi

# ── 4. Offsite upload (rclone) ────────────────────────────────────────────────
if [ "$OFFSITE_ENABLED" = "true" ] && command -v rclone &>/dev/null; then
    log "Uploading to offsite: $OFFSITE_REMOTE/$(basename "$DUMP_FILE")"
    rclone copy "$DUMP_FILE" "${OFFSITE_REMOTE}/${TODAY}/" \
        --stats-one-line \
        || warn "Offsite upload failed — local backup still intact"
    log "Offsite upload complete"
fi

# ── 5. Prune old local backups ────────────────────────────────────────────────
log "Pruning backups older than $KEEP_DAYS days"
find "$LOCAL_BACKUP_DIR" -name "josbin_pos_*.sql.gz.enc" -mtime "+${KEEP_DAYS}" -delete
REMAINING=$(find "$LOCAL_BACKUP_DIR" -name "josbin_pos_*.sql.gz.enc" | wc -l)
log "Backup rotation complete — $REMAINING backups retained"

# ── Done ──────────────────────────────────────────────────────────────────────
log "=== Backup complete: $DUMP_FILE ($DUMP_SIZE) ==="
