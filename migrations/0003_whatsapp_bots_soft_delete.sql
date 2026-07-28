ALTER TABLE whatsapp_bots
ADD COLUMN IF NOT EXISTS deleted_at timestamp;

CREATE INDEX IF NOT EXISTS whatsapp_bots_deleted_at_idx
ON whatsapp_bots (deleted_at);
