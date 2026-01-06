-- Migration: Adicionar constraint unique no email de email_monitors
-- Data: 2025-01-06
-- Descrição: Previne duplicação de emails nos monitores

-- Primeiro, remover duplicatas mantendo apenas o mais recente de cada email
-- (manter o monitor com maior created_at para cada email)
DELETE FROM email_monitors
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(email)) ORDER BY created_at DESC) as rn
    FROM email_monitors
  ) t
  WHERE rn > 1
);

-- Adicionar constraint unique no email (case-insensitive)
-- Como o PostgreSQL não suporta unique case-insensitive diretamente,
-- vamos criar um índice único funcional
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_monitors_email_unique 
ON email_monitors(LOWER(TRIM(email)));

-- Comentário
COMMENT ON INDEX idx_email_monitors_email_unique IS 'Garante que cada email seja único (case-insensitive)';


