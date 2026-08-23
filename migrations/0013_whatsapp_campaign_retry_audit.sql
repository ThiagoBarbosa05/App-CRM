CREATE TABLE IF NOT EXISTS "whatsapp_campaign_retry_audits" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "campaign_id" varchar NOT NULL REFERENCES "whatsapp_campaigns"("id") ON DELETE CASCADE,
  "actor_id" varchar NOT NULL REFERENCES "users"("id"),
  "override_dedupe" boolean DEFAULT false NOT NULL,
  "reason" text,
  "requeued_messages" integer NOT NULL,
  "conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "wa_campaign_retry_audits_campaign_idx"
  ON "whatsapp_campaign_retry_audits" ("campaign_id", "created_at");
