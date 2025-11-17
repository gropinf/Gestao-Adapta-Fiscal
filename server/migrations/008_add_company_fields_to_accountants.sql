-- Migration: Adicionar campos de empresa na tabela accountants
-- Data: 2025-11-05
-- Descrição: Transforma accountants em uma entidade mais completa, similar a companies,
--            pois contabilidades também são empresas

-- Adicionar campo CNPJ (único, mas opcional para retrocompatibilidade)
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS cnpj VARCHAR(14) UNIQUE;

-- Adicionar campo nome_fantasia
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS nome_fantasia TEXT;

-- Adicionar campo inscricao_estadual
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT;

-- Adicionar campo CRT (Código de Regime Tributário)
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS crt VARCHAR(1);

-- Adicionar campo telefone
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS telefone VARCHAR(15);

-- Adicionar campos de endereço
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS rua TEXT;
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS bairro TEXT;
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS uf VARCHAR(2);
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS cep VARCHAR(8);

-- Adicionar campo ativo (padrão true)
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN accountants.cnpj IS 'CNPJ da contabilidade (14 dígitos sem formatação)';
COMMENT ON COLUMN accountants.nome IS 'Razão Social / Nome da Contabilidade';
COMMENT ON COLUMN accountants.nome_fantasia IS 'Nome Fantasia da contabilidade';
COMMENT ON COLUMN accountants.inscricao_estadual IS 'Inscrição Estadual';
COMMENT ON COLUMN accountants.crt IS 'Código de Regime Tributário (1=Simples Nacional, 2=Simples excesso, 3=Normal, 4=MEI)';
COMMENT ON COLUMN accountants.telefone IS 'Telefone de contato';
COMMENT ON COLUMN accountants.email_contador IS 'Email principal do contador';
COMMENT ON COLUMN accountants.ativo IS 'Indica se a contabilidade está ativa no sistema';

-- Criar índice para CNPJ (melhorar performance de buscas)
CREATE INDEX IF NOT EXISTS idx_accountants_cnpj ON accountants(cnpj) WHERE cnpj IS NOT NULL;

-- Criar índice para busca por nome
CREATE INDEX IF NOT EXISTS idx_accountants_nome ON accountants(nome);






