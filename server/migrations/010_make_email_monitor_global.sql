-- Migration: Tornar email_monitors global (remover vínculo obrigatório com empresa)
-- Data: 2025-01-06
-- Descrição: Monitor de email é funcionalidade global, não vinculada a empresa específica

-- Tornar company_id nullable e mudar ON DELETE para SET NULL
ALTER TABLE email_monitors 
  ALTER COLUMN company_id DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS email_monitors_company_id_fkey;

-- Recriar constraint com ON DELETE SET NULL
ALTER TABLE email_monitors 
  ADD CONSTRAINT email_monitors_company_id_fkey 
  FOREIGN KEY (company_id) 
  REFERENCES companies(id) 
  ON DELETE SET NULL;

-- Comentário atualizado
COMMENT ON COLUMN email_monitors.company_id IS 'ID da empresa (opcional) - Monitor é funcionalidade global que processa XMLs de todas as empresas';


