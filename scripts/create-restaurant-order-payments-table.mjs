/**
 * Fase 3 do PDV Restaurante: dividir conta (split bill) — múltiplos
 * pagamentos por comanda.
 *
 * Uso:
 *   node scripts/create-restaurant-order-payments-table.mjs
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
  CREATE TABLE IF NOT EXISTS restaurant_order_payments (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id varchar NOT NULL REFERENCES restaurant_orders(id),
    method text NOT NULL,
    amount decimal(10, 2) NOT NULL,
    payer_label text,
    created_at timestamp NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS restaurant_order_payments_order_idx
  ON restaurant_order_payments (order_id)
`;

console.log(
  "[migration] Tabela restaurant_order_payments criada (ou já existente).",
);
