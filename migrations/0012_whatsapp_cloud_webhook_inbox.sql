CREATE TABLE IF NOT EXISTS whatsapp_cloud_webhook_inbox (
  event_id varchar PRIMARY KEY,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamp NOT NULL DEFAULT now(),
  last_error text,
  received_at timestamp NOT NULL DEFAULT now(),
  processed_at timestamp
);

CREATE INDEX IF NOT EXISTS whatsapp_cloud_webhook_inbox_pending_idx
  ON whatsapp_cloud_webhook_inbox(status, next_attempt_at);
