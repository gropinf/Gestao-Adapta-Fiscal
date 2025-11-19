-- Migration: Adicionar tabelas email_monitors, access_requests e user_access_logs
-- Data: 2025-11-04
-- Descrição: Criação das tabelas faltantes do schema

-- Tabela: email_monitors
-- Monitora emails (IMAP) para download automático de XMLs
CREATE TABLE IF NOT EXISTS email_monitors (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password TEXT NOT NULL,
  host VARCHAR(255) NOT NULL,
  port INTEGER NOT NULL,
  ssl BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE email_monitors IS 'Monitoramento de email (IMAP) para download automático de XMLs';
COMMENT ON COLUMN email_monitors.password IS 'Senha criptografada do email';
COMMENT ON COLUMN email_monitors.last_checked_at IS 'Última vez que o email foi verificado';

-- Tabela: access_requests
-- Solicitações de acesso ao sistema
CREATE TABLE IF NOT EXISTS access_requests (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email VARCHAR(255) NOT NULL,
  cnpj VARCHAR(14),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by VARCHAR REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE access_requests IS 'Solicitações de acesso ao sistema';
COMMENT ON COLUMN access_requests.status IS 'Status da solicitação: pending, approved, rejected';
COMMENT ON COLUMN access_requests.message IS 'Mensagem opcional do solicitante';

-- Tabela: user_access_logs
-- Histórico de acesso dos usuários
CREATE TABLE IF NOT EXISTS user_access_logs (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id VARCHAR REFERENCES companies(id) ON DELETE SET NULL,
  login_at TIMESTAMP,
  logout_at TIMESTAMP,
  switched_company_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_access_logs IS 'Histórico de acesso dos usuários';
COMMENT ON COLUMN user_access_logs.login_at IS 'Data e hora do login';
COMMENT ON COLUMN user_access_logs.logout_at IS 'Data e hora do logout';
COMMENT ON COLUMN user_access_logs.switched_company_at IS 'Data e hora da troca de empresa';
COMMENT ON COLUMN user_access_logs.ip_address IS 'Endereço IP do acesso';

-- Índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_email_monitors_company_id ON email_monitors(company_id);
CREATE INDEX IF NOT EXISTS idx_email_monitors_active ON email_monitors(active);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_user_access_logs_user_id ON user_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_logs_company_id ON user_access_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_user_access_logs_created_at ON user_access_logs(created_at DESC);









