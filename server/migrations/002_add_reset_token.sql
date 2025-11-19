-- Migration: Adicionar campos reset_token e reset_expires_at na tabela users
-- Data: 2025-11-04
-- Descrição: Campos para funcionalidade de reset de senha

ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires_at TIMESTAMP;

-- Comentários das colunas
COMMENT ON COLUMN users.reset_token IS 'Token de reset de senha (UUID)';
COMMENT ON COLUMN users.reset_expires_at IS 'Data de expiração do token de reset (1 hora)';









