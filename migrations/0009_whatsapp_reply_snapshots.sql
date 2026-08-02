-- Snapshots da mensagem citada recebida por canais WhatsApp via QR Code.
-- Permitem renderizar a citação mesmo quando o stanzaId não encontra a
-- mensagem original em whatsapp_messages.
ALTER TABLE "whatsapp_messages"
  ADD COLUMN IF NOT EXISTS "reply_to_content_snapshot" text,
  ADD COLUMN IF NOT EXISTS "reply_to_type_snapshot" text,
  ADD COLUMN IF NOT EXISTS "reply_to_direction_snapshot" text;

