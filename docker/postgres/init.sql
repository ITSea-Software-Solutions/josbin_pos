-- Josbin POS PostgreSQL initialisation
-- Runs once when the container is first created (empty data directory).
--
-- Extensions are installed into template1 so any DB created later on this
-- cluster (e.g. josbin_pos_demo, josbin_pos_sandbox) inherits them
-- automatically — no need to run CREATE EXTENSION per-DB.

\connect template1
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- And in the default POSTGRES_DB (which was created before this script ran)
\connect :"POSTGRES_DB"
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
ALTER DATABASE :"POSTGRES_DB" SET timezone TO 'America/Paramaribo';

-- Confirm extensions loaded
DO $$
BEGIN
  RAISE NOTICE 'pgvector version: %', (SELECT extversion FROM pg_extension WHERE extname = 'vector');
  RAISE NOTICE 'pgcrypto loaded: %', (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pgcrypto');
  RAISE NOTICE 'pg_trgm loaded: %', (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_trgm');
END $$;
