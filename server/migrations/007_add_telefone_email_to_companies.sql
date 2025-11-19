-- Migration: Adicionar campos telefone e email na tabela companies
-- Data: 2025-11-05
-- Descrição: Adiciona campos de contato (telefone e email) para empresas/clientes
--            e atualiza o campo CRT para CHAR(1) conforme especificação da nota fiscal

-- Adicionar campo telefone (máximo 15 caracteres para incluir código do país e formatação)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS telefone VARCHAR(15);

-- Adicionar campo email (texto para permitir emails longos)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email TEXT;

-- Modificar campo CRT para CHAR(1) conforme especificação
-- CRT - Código de Regime Tributário:
-- 1 = Simples Nacional
-- 2 = Simples Nacional, excesso de sublimite de receita bruta
-- 3 = Regime Normal (Lucro Presumido ou Lucro Real)
-- 4 = Microempreendedor Individual (MEI)
ALTER TABLE companies ALTER COLUMN crt TYPE VARCHAR(1);

-- Comentários nas colunas para documentação
COMMENT ON COLUMN companies.telefone IS 'Telefone de contato da empresa (formato: +55 11 91234-5678)';
COMMENT ON COLUMN companies.email IS 'Email de contato da empresa';
COMMENT ON COLUMN companies.crt IS 'Código de Regime Tributário (1=Simples Nacional, 2=Simples excesso, 3=Normal, 4=MEI)';







