-- APPLY MANUALLY: idempotent schema for the automation delivery outbox.
-- Do not run db:push for this change. Run the diagnostic query below before
-- creating the campaign unique index.

BEGIN;

CREATE TABLE IF NOT EXISTS automation_deliveries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id varchar NOT NULL REFERENCES automation_rules(id),
  client_id varchar REFERENCES clients(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'email')),
  template_id varchar REFERENCES message_templates(id),
  event_key text NOT NULL,
  recipient text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'success', 'failed', 'unknown')),
  attempt_count integer NOT NULL DEFAULT 1,
  provider_message_id text,
  error_message text,
  claimed_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT automation_deliveries_event_channel_unique UNIQUE (event_key, channel)
);

CREATE INDEX IF NOT EXISTS automation_deliveries_rule_idx ON automation_deliveries(rule_id);
CREATE INDEX IF NOT EXISTS automation_deliveries_client_idx ON automation_deliveries(client_id);
CREATE INDEX IF NOT EXISTS automation_deliveries_status_idx ON automation_deliveries(status);

ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS archived_at timestamp;
ALTER TABLE message_templates ADD COLUMN IF NOT EXISTS archived_at timestamp;
ALTER TABLE sms_campaign_messages ADD COLUMN IF NOT EXISTS normalized_phone text;
ALTER TABLE sms_campaign_messages ADD COLUMN IF NOT EXISTS claimed_at timestamp;

-- The existing status column is text in deployed databases. `processing` is
-- used as a worker claim and `unknown` marks a provider result that must not
-- be retried automatically; neither requires an enum migration.

UPDATE sms_campaign_messages
SET normalized_phone = CASE
  WHEN regexp_replace(phone, '\\D', '', 'g') LIKE '55%'
    THEN '+' || regexp_replace(phone, '\\D', '', 'g')
  ELSE '+55' || regexp_replace(phone, '\\D', '', 'g')
END
WHERE normalized_phone IS NULL;

COMMIT;

-- Diagnostic only. Resolve duplicate rows manually before executing the index below.
-- SELECT campaign_id, normalized_phone, count(*) AS quantity
-- FROM sms_campaign_messages
-- GROUP BY campaign_id, normalized_phone
-- HAVING count(*) > 1;

-- After resolving the diagnostic output:
-- CREATE UNIQUE INDEX IF NOT EXISTS sms_campaign_messages_campaign_phone_unique
-- ON sms_campaign_messages(campaign_id, normalized_phone);

-- Validation:
-- SELECT status, count(*) FROM automation_deliveries GROUP BY status;
-- SELECT campaign_id, normalized_phone, count(*) FROM sms_campaign_messages
-- GROUP BY campaign_id, normalized_phone HAVING count(*) > 1;
