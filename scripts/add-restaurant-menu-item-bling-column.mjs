/**
 * Adiciona a coluna bling_product_id em restaurant_menu_items, permitindo
 * vincular itens do cardápio a produtos sincronizados do Bling (sync idempotente).
 *
 * Uso:
 *   node scripts/add-restaurant-menu-item-bling-column.mjs
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
  ALTER TABLE restaurant_menu_items ADD COLUMN IF NOT EXISTS bling_product_id text
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS restaurant_menu_items_bling_product_id_uidx
  ON restaurant_menu_items (bling_product_id) WHERE bling_product_id IS NOT NULL
`;

console.log(
  "[migration] Coluna bling_product_id adicionada em restaurant_menu_items (ou já existente).",
);
