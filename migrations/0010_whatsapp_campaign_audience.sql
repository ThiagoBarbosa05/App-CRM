ALTER TABLE whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS audience_selector jsonb;

CREATE INDEX IF NOT EXISTS wa_campaign_messages_suppression_reason_idx
  ON whatsapp_campaign_messages (campaign_id, suppression_reason)
  WHERE status = 'suppressed';
