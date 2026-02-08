ALTER TABLE xml_download_history
ADD COLUMN IF NOT EXISTS current_stage TEXT,
ADD COLUMN IF NOT EXISTS last_message TEXT,
ADD COLUMN IF NOT EXISTS progress_updated_at TIMESTAMP;
