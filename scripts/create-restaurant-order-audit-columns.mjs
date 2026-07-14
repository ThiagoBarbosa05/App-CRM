/**
 * Fase 2 do PDV Restaurante: cancelamento de item com motivo (soft-cancel),
 * desconto em comandas e trilha de auditoria.
 *
 * Uso:
 *   node scripts/create-restaurant-order-audit-columns.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

// Soft-cancel em restaurant_order_items
await sql`
  ALTER TABLE restaurant_order_items ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo'
`;
await sql`
  ALTER TABLE restaurant_order_items ADD COLUMN IF NOT EXISTS cancel_reason text
`;
await sql`
  ALTER TABLE restaurant_order_items ADD COLUMN IF NOT EXISTS cancelled_by varchar REFERENCES users(id)
`;
await sql`
  ALTER TABLE restaurant_order_items ADD COLUMN IF NOT EXISTS cancelled_at timestamp
`;

// Desconto em restaurant_orders
await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS discount_percent decimal(5, 2)
`;
await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS discount_amount decimal(10, 2)
`;
await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS discount_reason text
`;
await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS discount_applied_by varchar REFERENCES users(id)
`;

// Trilha de auditoria
await sql`
  CREATE TABLE IF NOT EXISTS restaurant_order_audit_log (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id varchar NOT NULL REFERENCES restaurant_orders(id),
    action text NOT NULL,
    reason text,
    actor_id varchar NOT NULL REFERENCES users(id),
    metadata jsonb,
    created_at timestamp NOT NULL DEFAULT now()
  )
`;
await sql`
  CREATE INDEX IF NOT EXISTS restaurant_order_audit_log_order_idx
  ON restaurant_order_audit_log (order_id)
`;

console.log(
  "[migration] Cancelamento auditável, desconto e restaurant_order_audit_log criados (ou já existentes).",
);
