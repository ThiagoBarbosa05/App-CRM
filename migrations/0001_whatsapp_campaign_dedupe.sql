ALTER TABLE "whatsapp_campaigns"
  ADD COLUMN IF NOT EXISTS "dedupe_window_hours" integer DEFAULT 24 NOT NULL,
  ADD COLUMN IF NOT EXISTS "post_send_whatsapp_tag_id" varchar REFERENCES "whatsapp_tags"("id"),
  ADD COLUMN IF NOT EXISTS "content_fingerprint_snapshot" text;

ALTER TABLE "whatsapp_campaign_messages"
  ADD COLUMN IF NOT EXISTS "phone_normalized" text,
  ADD COLUMN IF NOT EXISTS "content_fingerprint" text,
  ADD COLUMN IF NOT EXISTS "suppression_reason" text,
  ADD COLUMN IF NOT EXISTS "conflicting_campaign_message_id" varchar,
  ADD COLUMN IF NOT EXISTS "tag_application_status" text DEFAULT 'not_requested' NOT NULL,
  ADD COLUMN IF NOT EXISTS "tag_application_error" text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname IN (
      'whatsapp_campaign_messages_status_check',
      'umbler_campaign_messages_status_check'
    )
  ) THEN
    ALTER TABLE "whatsapp_campaign_messages"
      DROP CONSTRAINT IF EXISTS "whatsapp_campaign_messages_status_check",
      DROP CONSTRAINT IF EXISTS "umbler_campaign_messages_status_check";
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS "whatsapp_campaign_impacts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "phone_normalized" text NOT NULL,
  "content_fingerprint" text NOT NULL,
  "campaign_id" varchar NOT NULL REFERENCES "whatsapp_campaigns"("id") ON DELETE CASCADE,
  "campaign_message_id" varchar NOT NULL UNIQUE REFERENCES "whatsapp_campaign_messages"("id") ON DELETE CASCADE,
  "scheduled_for" timestamp NOT NULL,
  "sent_at" timestamp,
  "status" text DEFAULT 'reserved' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "wa_campaign_impacts_lookup_idx"
  ON "whatsapp_campaign_impacts" ("phone_normalized", "content_fingerprint", "scheduled_for");
