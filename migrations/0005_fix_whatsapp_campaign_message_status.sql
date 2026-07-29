ALTER TABLE "whatsapp_campaign_messages"
  DROP CONSTRAINT IF EXISTS "whatsapp_campaign_messages_status_check",
  DROP CONSTRAINT IF EXISTS "umbler_campaign_messages_status_check";

ALTER TABLE "whatsapp_campaign_messages"
  ADD CONSTRAINT "whatsapp_campaign_messages_status_check"
  CHECK (
    "status" IN (
      'scheduled',
      'sent',
      'delivered',
      'read',
      'failed',
      'cancelled',
      'suppressed'
    )
  );
