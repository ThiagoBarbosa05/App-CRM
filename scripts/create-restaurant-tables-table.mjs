/**
 * Cria a tabela restaurant_tables (registro fixo de mesas do PDV Restaurante)
 * e adiciona table_id + payment_requested_at em restaurant_orders, permitindo
 * o mapa visual de mesas (livre/ocupada/aguardando pagamento).
 *
 * Uso:
 *   node scripts/create-restaurant-tables-table.mjs
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
  CREATE TABLE IF NOT EXISTS restaurant_tables (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    number integer NOT NULL,
    capacity integer NOT NULL DEFAULT 4,
    section text,
    is_active boolean NOT NULL DEFAULT true,
    created_by varchar NOT NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS restaurant_tables_number_active_uidx
  ON restaurant_tables (number) WHERE is_active = true
`;

await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS table_id varchar REFERENCES restaurant_tables(id)
`;

await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS payment_requested_at timestamp
`;

await sql`
  CREATE INDEX IF NOT EXISTS restaurant_orders_table_idx ON restaurant_orders (table_id)
`;

console.log(
  "[migration] Tabela restaurant_tables criada e restaurant_orders.table_id/payment_requested_at adicionados (ou já existentes).",
);
