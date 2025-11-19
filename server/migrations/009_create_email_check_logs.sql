-- Migration: Create email_check_logs table
-- Description: Tabela para armazenar logs de tentativas de verificação de email (IMAP)
-- Date: 2025-11-06

CREATE TABLE IF NOT EXISTS email_check_logs (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email_monitor_id VARCHAR(255) NOT NULL REFERENCES email_monitors(id) ON DELETE CASCADE,
  email_address VARCHAR(255) NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP,
  duration_ms INTEGER,
  emails_checked INTEGER DEFAULT 0 NOT NULL,
  xmls_found INTEGER DEFAULT 0 NOT NULL,
  xmls_processed INTEGER DEFAULT 0 NOT NULL,
  xmls_duplicated INTEGER DEFAULT 0 NOT NULL,
  error_message TEXT,
  error_details TEXT,
  triggered_by TEXT DEFAULT 'manual' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_check_logs_monitor_id ON email_check_logs(email_monitor_id);
CREATE INDEX IF NOT EXISTS idx_email_check_logs_status ON email_check_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_check_logs_started_at ON email_check_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_check_logs_email_address ON email_check_logs(email_address);

-- Add comment to table
COMMENT ON TABLE email_check_logs IS 'Logs de tentativas de verificação de email (IMAP) - histórico detalhado de todas as verificações';
COMMENT ON COLUMN email_check_logs.email_monitor_id IS 'ID do monitor de email relacionado';
COMMENT ON COLUMN email_check_logs.email_address IS 'Endereço de email que foi verificado';
COMMENT ON COLUMN email_check_logs.status IS 'Status da verificação: success ou error';
COMMENT ON COLUMN email_check_logs.started_at IS 'Data/hora de início da verificação';
COMMENT ON COLUMN email_check_logs.finished_at IS 'Data/hora de término da verificação';
COMMENT ON COLUMN email_check_logs.duration_ms IS 'Duração da verificação em milissegundos';
COMMENT ON COLUMN email_check_logs.emails_checked IS 'Quantidade de emails verificados';
COMMENT ON COLUMN email_check_logs.xmls_found IS 'Quantidade de XMLs encontrados';
COMMENT ON COLUMN email_check_logs.xmls_processed IS 'Quantidade de XMLs processados com sucesso';
COMMENT ON COLUMN email_check_logs.xmls_duplicated IS 'Quantidade de XMLs que eram duplicados';
COMMENT ON COLUMN email_check_logs.error_message IS 'Mensagem de erro (se houver)';
COMMENT ON COLUMN email_check_logs.error_details IS 'Detalhes dos erros em formato JSON (array de strings)';
COMMENT ON COLUMN email_check_logs.triggered_by IS 'Quem/o quê iniciou a verificação: manual, cron, api';





