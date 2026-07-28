ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS wa_channel_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaigns_wa_channel_id_whatsapp_channels_id_fk'
  ) THEN
    ALTER TABLE campaigns
    ADD CONSTRAINT campaigns_wa_channel_id_whatsapp_channels_id_fk
    FOREIGN KEY (wa_channel_id)
    REFERENCES whatsapp_channels(id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS campaigns_wa_channel_id_idx
ON campaigns (wa_channel_id);
