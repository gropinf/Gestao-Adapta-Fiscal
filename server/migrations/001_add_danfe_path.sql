-- Migration: Adicionar campo danfe_path na tabela xmls
-- Data: 2025-11-03
-- Descrição: Campo para armazenar o caminho do PDF DANFE gerado

ALTER TABLE xmls ADD COLUMN IF NOT EXISTS danfe_path TEXT;

-- Comentário da coluna
COMMENT ON COLUMN xmls.danfe_path IS 'Caminho relativo do arquivo PDF DANFE gerado';











