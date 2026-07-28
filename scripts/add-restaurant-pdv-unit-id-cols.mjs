/**
 * Adiciona `unit_id` às tabelas do PDV Restaurante que ficaram sem essa
 * coluna quando o suporte multi-unidade foi introduzido no schema Drizizzle
 * (shared/schema.ts) sem uma migração correspondente ter sido escrita:
 * restaurant_menu_items, restaurant_orders e restaurant_tables.
 *
 * Coluna nullable, sem backfill — mesma linha de add-whatsapp-channel-default-sector.mjs.
 * Registros existentes ficam com unit_id NULL (tratado como legado pelo guard
 * de unidade); rode scripts/backfill-restaurant-pdv-unit-id.mjs depois se
 * precisar preenchê-los.
 *
 * Uso:
 *   node scripts/add-restaurant-pdv-unit-id-cols.mjs
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
  ALTER TABLE restaurant_menu_items
  ADD COLUMN IF NOT EXISTS unit_id varchar REFERENCES pdv_units(id)
`;
console.log("[migration] Coluna restaurant_menu_items.unit_id criada (ou já existente).");

await sql`
  ALTER TABLE restaurant_orders
  ADD COLUMN IF NOT EXISTS unit_id varchar REFERENCES pdv_units(id)
`;
console.log("[migration] Coluna restaurant_orders.unit_id criada (ou já existente).");

await sql`
  ALTER TABLE restaurant_tables
  ADD COLUMN IF NOT EXISTS unit_id varchar REFERENCES pdv_units(id)
`;
console.log("[migration] Coluna restaurant_tables.unit_id criada (ou já existente).");

console.log("[migration] Concluído.");
