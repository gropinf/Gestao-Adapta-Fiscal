-- Migration: Adicionar CRT em companies e numero_nota em xmls
-- Data: 2025-11-04
-- Descrição: Adiciona campo CRT (Código de Regime Tributário) para empresas
--            e número da nota (nNF) para XMLs

-- Adiciona campo CRT na tabela companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS crt TEXT;

COMMENT ON COLUMN companies.crt IS 'Código de Regime Tributário: 1=Simples Nacional, 2=Simples Nacional excesso, 3=Regime Normal';

-- Adiciona campo numero_nota na tabela xmls
ALTER TABLE xmls ADD COLUMN IF NOT EXISTS numero_nota TEXT;

COMMENT ON COLUMN xmls.numero_nota IS 'Número da nota fiscal (nNF) extraído do XML';

-- Cria índice para facilitar buscas por número de nota
CREATE INDEX IF NOT EXISTS idx_xmls_numero_nota ON xmls(numero_nota);









