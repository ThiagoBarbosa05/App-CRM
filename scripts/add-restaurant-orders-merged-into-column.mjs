/**
 * Fase 4 do PDV Restaurante: transferir itens entre mesas / juntar mesas.
 * Adiciona merged_into_order_id em restaurant_orders (self-FK).
 *
 * Uso:
 *   node scripts/add-restaurant-orders-merged-into-column.mjs
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
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS merged_into_order_id varchar REFERENCES restaurant_orders(id)
`;

console.log(
  "[migration] Coluna merged_into_order_id adicionada em restaurant_orders (ou já existente).",
);
