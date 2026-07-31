ALTER TABLE "whatsapp_messages"
  ADD COLUMN IF NOT EXISTS "origin" text NOT NULL DEFAULT 'contact',
  ADD COLUMN IF NOT EXISTS "is_forwarded" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "forwarded_from_message_id" varchar,
  ADD COLUMN IF NOT EXISTS "forwarded_from_conversation_id" varchar
    REFERENCES "whatsapp_conversations"("id"),
  ADD COLUMN IF NOT EXISTS "provider_metadata" jsonb;

UPDATE "whatsapp_messages"
SET "origin" = CASE
  WHEN "campaign_message_id" IS NOT NULL THEN 'campaign'
  WHEN "sent_by_user_id" IS NOT NULL THEN 'crm'
  WHEN "direction" = 'outbound' THEN 'device'
  ELSE 'contact'
END
WHERE "origin" = 'contact';

ALTER TABLE "whatsapp_messages"
  ADD CONSTRAINT "whatsapp_messages_origin_check"
  CHECK ("origin" IN ('crm', 'device', 'contact', 'bot', 'campaign'));

ALTER TABLE "whatsapp_channels"
  ADD COLUMN IF NOT EXISTS "device_echo_enabled" boolean NOT NULL DEFAULT false;
