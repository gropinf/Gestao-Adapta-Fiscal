-- Migration: Tornar company_id opcional na tabela xmls
-- Data: 2025-11-04
-- Descrição: O campo company_id não é mais necessário pois a filtragem é feita por CNPJ
-- Os XMLs devem aparecer para ambos emitente e destinatário baseado apenas nos CNPJs

-- Remove a constraint NOT NULL do campo company_id
ALTER TABLE xmls ALTER COLUMN company_id DROP NOT NULL;

-- Atualiza a ação de delete para SET NULL em vez de CASCADE
-- Primeiro remove a constraint existente
ALTER TABLE xmls DROP CONSTRAINT IF EXISTS xmls_company_id_companies_id_fk;

-- Recria a constraint com ON DELETE SET NULL
ALTER TABLE xmls ADD CONSTRAINT xmls_company_id_companies_id_fk 
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- Comentário atualizado
COMMENT ON COLUMN xmls.company_id IS 'DEPRECATED: Campo opcional mantido por compatibilidade. Use cnpj_emitente e cnpj_destinatario para filtros.';








