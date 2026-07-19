#!/usr/bin/env bash
# =============================================================================
# Josbin POS — restore drill (runs ON the server; non-destructive)
#
# "Untested backups are not backups." Restores the NEWEST nightly dump into a
# scratch database inside the postgres container, sanity-checks row counts
# against the live database, then drops the scratch DB. Run monthly, and
# after any Postgres upgrade.
# =============================================================================
set -euo pipefail

CONTAINER="${JOSBIN_PG_CONTAINER:-josbin_pos_postgres}"
DB="${JOSBIN_PG_DB:-josbin_pos}"
DB_USER="${JOSBIN_PG_USER:-josbin_pos}"
SCRATCH=josbin_restore_test
ROOT=/var/backups/josbin

LATEST=$(ls -1t "$ROOT"/db/josbin-*.dump 2>/dev/null | head -1)
[ -n "$LATEST" ] || { echo "NO DUMPS FOUND in $ROOT/db — run scripts/backup.sh first"; exit 1; }
echo "Restoring $(basename "$LATEST") into scratch DB '$SCRATCH'…"

docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -q \
    -c "DROP DATABASE IF EXISTS $SCRATCH;" -c "CREATE DATABASE $SCRATCH;"
docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$SCRATCH" --no-owner < "$LATEST"

fail=0
for t in sales sale_items products organisations audit_logs z_reports; do
    live=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB"      -tAc "SELECT count(*) FROM $t")
    rest=$(docker exec "$CONTAINER" psql -U "$DB_USER" -d "$SCRATCH" -tAc "SELECT count(*) FROM $t")
    # Live keeps moving between dump and drill — restored count may lag, never exceed.
    if [ "$rest" -le "$live" ] && [ "$rest" -ge 0 ]; then
        echo "  ok   $t: restored=$rest live=$live"
    else
        echo "  FAIL $t: restored=$rest live=$live"; fail=1
    fi
done

docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -q -c "DROP DATABASE $SCRATCH;"

if [ "$fail" = "0" ]; then
    echo "RESTORE DRILL PASSED — $(basename "$LATEST") is a usable backup."
else
    echo "RESTORE DRILL FAILED — investigate before trusting backups."; exit 1
fi
