CREATE TABLE IF NOT EXISTS r2_migration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'processing',
  dry_run BOOLEAN NOT NULL DEFAULT false,
  delete_from_contabo BOOLEAN NOT NULL DEFAULT false,
  batch_size INTEGER NOT NULL DEFAULT 200,
  prefix TEXT,
  total_processed INTEGER NOT NULL DEFAULT 0,
  migrated INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  last_key TEXT,
  last_message TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP
);
