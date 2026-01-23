-- Migration: Adicionar flag delete_after_process em email_monitors
-- Data: 2026-01-23
-- Descrição: Permite deletar emails após processamento bem-sucedido

ALTER TABLE email_monitors
ADD COLUMN IF NOT EXISTS delete_after_process BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN email_monitors.delete_after_process IS 'Apagar email após processamento bem-sucedido';
