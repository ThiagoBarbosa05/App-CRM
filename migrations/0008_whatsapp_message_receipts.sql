ALTER TABLE "whatsapp_messages"
  ADD COLUMN IF NOT EXISTS "delivered_at" timestamp,
  ADD COLUMN IF NOT EXISTS "read_at" timestamp;

UPDATE "whatsapp_messages"
SET
  "delivered_at" = CASE
    WHEN "status" IN ('delivered', 'read') THEN COALESCE("sent_at", "created_at")
    ELSE "delivered_at"
  END,
  "read_at" = CASE
    WHEN "status" = 'read' THEN COALESCE("sent_at", "created_at")
    ELSE "read_at"
  END
WHERE "status" IN ('delivered', 'read');
