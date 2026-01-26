-- Migration: Adicionar campos de certificado A1 na tabela companies
-- Data: 2026-01-23

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS certificado_path TEXT,
ADD COLUMN IF NOT EXISTS certificado_senha TEXT;

COMMENT ON COLUMN companies.certificado_path IS 'URL/Path do certificado A1 no storage';
COMMENT ON COLUMN companies.certificado_senha IS 'Senha do certificado A1';
