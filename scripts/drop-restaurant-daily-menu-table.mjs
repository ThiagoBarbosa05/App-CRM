/**
 * Remove a feature "Cardápio do Dia" do PDV Restaurante — não é mais
 * necessária, o vendedor agora adiciona itens direto do cardápio ativo.
 * Derruba a tabela restaurant_daily_menu_items (e seus índices, dropados
 * automaticamente com a tabela). Criada por
 * scripts/create-restaurant-daily-menu-and-product-link.mjs.
 *
 * Uso:
 *   node scripts/drop-restaurant-daily-menu-table.mjs
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
  DROP TABLE IF EXISTS restaurant_daily_menu_items
`;

console.log(
  "[migration] Tabela restaurant_daily_menu_items removida (ou já inexistente).",
);
