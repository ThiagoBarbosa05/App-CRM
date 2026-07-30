ALTER TABLE whatsapp_channels
  ADD COLUMN IF NOT EXISTS qr_backend text NOT NULL DEFAULT 'embedded';

CREATE TABLE IF NOT EXISTS baileys_gateway_webhook_inbox (
  event_id varchar PRIMARY KEY,
  event_name text NOT NULL,
  instance_name text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamp NOT NULL DEFAULT now(),
  last_error text,
  received_at timestamp NOT NULL DEFAULT now(),
  processed_at timestamp
);

CREATE INDEX IF NOT EXISTS baileys_gateway_webhook_inbox_pending_idx
  ON baileys_gateway_webhook_inbox(status, next_attempt_at);
