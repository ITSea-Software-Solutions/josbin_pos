-- Josbin POS PostgreSQL initialisation
-- Runs once when the container is first created

-- Enable pgvector extension (required for product embeddings / semantic search)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable pgcrypto (field-level encryption helper)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enable pg_trgm (trigram similarity for smart product search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Set timezone for all connections
ALTER DATABASE josbin_pos SET timezone TO 'America/Paramaribo';

-- Confirm extensions loaded
DO $$
BEGIN
  RAISE NOTICE 'pgvector version: %', (SELECT extversion FROM pg_extension WHERE extname = 'vector');
  RAISE NOTICE 'pgcrypto loaded: %', (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pgcrypto');
  RAISE NOTICE 'pg_trgm loaded: %', (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pg_trgm');
END $$;
