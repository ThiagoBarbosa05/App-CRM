-- Migration: Add umbler_contact_snapshot table
-- Created: 2026-01-15
-- Purpose: Snapshot de contatos do Umbler para sincronização de tags

CREATE TABLE IF NOT EXISTS umbler_contact_snapshot (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_client_id VARCHAR NOT NULL UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  umbler_contact_id TEXT,
  tags_hash TEXT,
  tags_json TEXT,
  last_synced_at TIMESTAMP,
  last_checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  not_found_at TIMESTAMP,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'not_found', 'error')),
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Índices para otimização de queries
CREATE INDEX IF NOT EXISTS umbler_snapshot_client_idx ON umbler_contact_snapshot(crm_client_id);
CREATE INDEX IF NOT EXISTS umbler_snapshot_phone_idx ON umbler_contact_snapshot(phone_e164);
CREATE INDEX IF NOT EXISTS umbler_snapshot_last_checked_idx ON umbler_contact_snapshot(last_checked_at);
CREATE INDEX IF NOT EXISTS umbler_snapshot_not_found_idx ON umbler_contact_snapshot(not_found_at);
CREATE INDEX IF NOT EXISTS umbler_snapshot_status_idx ON umbler_contact_snapshot(sync_status);

-- Comentários descritivos
COMMENT ON TABLE umbler_contact_snapshot IS 'Snapshot de contatos do Umbler para sincronização de tags (source of truth: Umbler)';
COMMENT ON COLUMN umbler_contact_snapshot.crm_client_id IS 'ID do cliente no CRM (foreign key)';
COMMENT ON COLUMN umbler_contact_snapshot.phone_e164 IS 'Telefone no formato E.164 (+5511999999999)';
COMMENT ON COLUMN umbler_contact_snapshot.umbler_contact_id IS 'ID do contato no Umbler';
COMMENT ON COLUMN umbler_contact_snapshot.tags_hash IS 'Hash SHA-256 das tags para detectar mudanças';
COMMENT ON COLUMN umbler_contact_snapshot.tags_json IS 'JSON stringified das tags do Umbler';
COMMENT ON COLUMN umbler_contact_snapshot.last_synced_at IS 'Última vez que as tags foram sincronizadas';
COMMENT ON COLUMN umbler_contact_snapshot.last_checked_at IS 'Última vez que o contato foi verificado';
COMMENT ON COLUMN umbler_contact_snapshot.not_found_at IS 'Data em que o contato foi marcado como não encontrado (cache de 7 dias)';
COMMENT ON COLUMN umbler_contact_snapshot.sync_status IS 'Status da sincronização: pending, synced, not_found, error';
COMMENT ON COLUMN umbler_contact_snapshot.error_message IS 'Mensagem de erro caso a sincronização falhe';
COMMENT ON COLUMN umbler_contact_snapshot.retry_count IS 'Número de tentativas de sincronização';
