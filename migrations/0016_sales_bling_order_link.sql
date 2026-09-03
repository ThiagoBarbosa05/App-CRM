ALTER TABLE "sales"
  ADD COLUMN IF NOT EXISTS "bling_order_id" varchar;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_bling_order_id_fkey'
  ) THEN
    ALTER TABLE "sales"
      ADD CONSTRAINT "sales_bling_order_id_fkey"
      FOREIGN KEY ("bling_order_id") REFERENCES "bling_orders"("id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "sales_bling_order_idx"
  ON "sales" ("bling_order_id");

WITH unique_matches AS (
  SELECT s.id AS sale_id, MIN(bo.id) AS bling_order_id
  FROM sales s
  INNER JOIN bling_orders bo
    ON bo.app_client_id = s.client_id
   AND bo.order_number = s.invoice_number
   AND bo.deleted_at IS NULL
  WHERE s.bling_order_id IS NULL
  GROUP BY s.id
  HAVING COUNT(*) = 1
)
UPDATE sales s
SET bling_order_id = unique_matches.bling_order_id,
    updated_at = NOW()
FROM unique_matches
WHERE s.id = unique_matches.sale_id;
