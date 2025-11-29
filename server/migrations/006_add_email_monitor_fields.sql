-- Migration: Adicionar campos de controle de monitoramento de email
-- Data: 2025-11-04
-- Descrição: Adiciona campos para controle de data inicial, último email processado e intervalo

-- Adicionar campo monitor_since (data inicial para monitoramento)
ALTER TABLE email_monitors ADD COLUMN IF NOT EXISTS monitor_since TIMESTAMP;

-- Adicionar campo last_email_id (ID do último email processado)
ALTER TABLE email_monitors ADD COLUMN IF NOT EXISTS last_email_id TEXT;

-- Adicionar campo check_interval_minutes (intervalo de verificação em minutos)
ALTER TABLE email_monitors ADD COLUMN IF NOT EXISTS check_interval_minutes INTEGER DEFAULT 15;

-- Comentários dos campos
COMMENT ON COLUMN email_monitors.monitor_since IS 'Data inicial para monitoramento - ignora emails anteriores a esta data';
COMMENT ON COLUMN email_monitors.last_email_id IS 'ID (UID) do último email processado - evita processar o mesmo email duas vezes';
COMMENT ON COLUMN email_monitors.check_interval_minutes IS 'Intervalo em minutos entre cada verificação da caixa de email (padrão: 15 minutos)';

-- Índice para facilitar busca de monitores ativos
CREATE INDEX IF NOT EXISTS idx_email_monitors_active_check ON email_monitors(active, last_checked_at) WHERE active = true;










