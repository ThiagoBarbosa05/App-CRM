/**
 * Estado de sincronizacao do pedido de venda no Bling por comanda, mais a
 * tabela de auditoria de tentativas (separada de restaurant_order_audit_log,
 * que exige um ator humano — aqui o "ator" é o job/tentativa automatica).
 *
 * Uso:
 *   node scripts/add-bling-sales-order-sync.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  ALTER TABLE restaurant_orders
  ADD COLUMN IF NOT EXISTS bling_sync_status text
  CHECK (bling_sync_status IN ('pendente','enviado','bloqueado','erro'))
`;
await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_sales_order_id text
`;
await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_sync_error text
`;
await sql`
  ALTER TABLE restaurant_orders
  ADD COLUMN IF NOT EXISTS bling_sync_attempts integer NOT NULL DEFAULT 0
`;
await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_sync_attempted_at timestamp
`;
console.log(
  "[migration] Colunas de sync Bling adicionadas em restaurant_orders (ou já existentes).",
);

await sql`
  CREATE TABLE IF NOT EXISTS restaurant_order_bling_sync_log (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id varchar NOT NULL REFERENCES restaurant_orders(id),
    unit_id varchar REFERENCES pdv_units(id),
    attempted_at timestamp NOT NULL DEFAULT now(),
    result text NOT NULL CHECK (result IN ('enviado','bloqueado','erro')),
    reason text,
    bling_sales_order_id text,
    created_at timestamp NOT NULL DEFAULT now()
  )
`;
await sql`
  CREATE INDEX IF NOT EXISTS restaurant_order_bling_sync_log_order_idx
  ON restaurant_order_bling_sync_log (order_id)
`;
await sql`
  CREATE INDEX IF NOT EXISTS restaurant_order_bling_sync_log_unit_idx
  ON restaurant_order_bling_sync_log (unit_id, result)
`;
console.log(
  "[migration] Tabela restaurant_order_bling_sync_log criada (ou já existente).",
);

console.log("[migration] Concluído.");
