/**
 * Adiciona o campo `notes` (observação por item) à tabela restaurant_order_items.
 * Permite que garçons registrem instruções específicas por item antes de lançar
 * o pedido (ex: "sem cebola", "bem passado").
 *
 * Uso:
 *   node scripts/add-restaurant-order-item-notes.mjs
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
  ALTER TABLE restaurant_order_items
  ADD COLUMN IF NOT EXISTS notes text
`;

console.log("✅ Coluna notes adicionada a restaurant_order_items (IF NOT EXISTS).");
