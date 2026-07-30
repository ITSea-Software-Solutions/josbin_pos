-- Josbin POS PostgreSQL initialisation
-- Runs once when the container is first created (empty data directory).
--
-- The docker entrypoint runs this file already connected to POSTGRES_DB, so
-- the app database gets its extensions from the direct CREATEs below. They are
-- also installed into template1 so any database created later on this cluster
-- (josbin_pos_demo, josbin_pos_sandbox, josbin_pos_test, …) inherits them.
--
-- NB: psql does NOT expand :"POSTGRES_DB" from the environment. An earlier
-- version of this file did `\connect :"POSTGRES_DB"`, which aborted the script
-- at that line on every fresh install — template1 got the extensions, the app
-- database did not (it is created BEFORE this script runs, from a then-bare
-- template1), and `php artisan migrate` then failed at the first vector()
-- column, leaving later migrations (incl. the spatie uuid fix) unapplied.

-- ── App database (current connection = POSTGRES_DB) ──────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Per-database timezone — defence in depth next to the app's DB_TIMEZONE pin.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET timezone TO %L',
                 current_database(), 'America/Paramaribo');
END $$;

-- ── template1 — future databases on this cluster inherit these ───────────────
\connect template1
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Confirm extensions loaded (visible in `docker logs` on first boot)
DO $$
BEGIN
  RAISE NOTICE 'pgvector version: %', (SELECT extversion FROM pg_extension WHERE extname = 'vector');
  RAISE NOTICE 'pgcrypto loaded: %', (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pgcrypto');
  RAISE NOTICE 'pg_trgm loaded: %', (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_trgm');
END $$;
