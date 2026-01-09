-- Migration: Aumentar tamanho do campo telefone de VARCHAR(15) para VARCHAR(20)
-- Data: 2025-01-11
-- Descrição: Aumenta o tamanho do campo telefone nas tabelas companies e accountants
--            para suportar números de telefone com formatação completa (ex: +55 11 98765-4321)
--            Resolve erro: "value too long for type character varying(15)"

-- Alterar campo telefone na tabela companies
ALTER TABLE companies ALTER COLUMN telefone TYPE VARCHAR(20);

-- Alterar campo telefone na tabela accountants
ALTER TABLE accountants ALTER COLUMN telefone TYPE VARCHAR(20);

-- Atualizar comentário
COMMENT ON COLUMN companies.telefone IS 'Telefone de contato da empresa (máximo 20 caracteres, formato: +55 11 91234-5678)';
COMMENT ON COLUMN accountants.telefone IS 'Telefone de contato da contabilidade (máximo 20 caracteres, formato: +55 11 91234-5678)';
