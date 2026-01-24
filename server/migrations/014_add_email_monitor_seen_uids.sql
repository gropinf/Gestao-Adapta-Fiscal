-- Migration: Criar tabela email_monitor_seen_uids
-- Data: 2026-01-23
-- Descrição: Guarda UIDs de emails já processados/ignorados

CREATE TABLE IF NOT EXISTS email_monitor_seen_uids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_monitor_id UUID NOT NULL REFERENCES email_monitors(id) ON DELETE CASCADE,
  email_uid TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (email_monitor_id, email_uid)
);

COMMENT ON TABLE email_monitor_seen_uids IS 'UIDs de emails já processados/ignorados pelo monitor';
COMMENT ON COLUMN email_monitor_seen_uids.reason IS 'processed_no_delete, no_xml, duplicate_xml';
