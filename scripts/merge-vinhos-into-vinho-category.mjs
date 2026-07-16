/**
 * Unifica as categorias de produto 'VINHOS' e 'VINHO' em 'VINHO'.
 *
 * Contexto: o catálogo tinha duas categorias para a mesma coisa. 'VINHOS' era a
 * registrada em product_categories (e o default do importador), então virou o
 * balaio onde toda importação caía — concentrava 73% dos preços zerados, 71%
 * dos produtos sem tipo e 74% dos sem bling_product_id. 'VINHO' tinha os 757
 * produtos curados, mas nem sequer existia como categoria registrada.
 *
 * Este script trata as três pontas. Mexer só em products.category faria a
 * categoria 'VINHOS' ressuscitar no próximo import/seed:
 *   1. products.category: 'VINHOS' -> 'VINHO'
 *   2. product_categories: renomeia a linha 'VINHOS' para 'VINHO'
 *   3. category_goals.category_name: 'VINHOS' -> 'VINHO' (as metas são
 *      chaveadas pelo nome da categoria, não por id)
 *
 * O seed DEFAULT_CATEGORIES (server/routes/product-categories.routes.ts) e o
 * default do importador (client/src/components/product-import-modal.tsx) foram
 * alterados junto, no mesmo commit.
 *
 * Idempotente: rodar de novo não faz nada.
 *
 * Uso:
 *   node scripts/merge-vinhos-into-vinho-category.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

const [{ count: antes }] = await sql`
  SELECT COUNT(*)::text AS count FROM products WHERE category = 'VINHOS'
`;
console.log(`[migration] Produtos em 'VINHOS': ${antes}`);

// Conta antes/depois em vez de usar RETURNING: o driver http do Neon não
// devolve as linhas de um UPDATE, e confiar nisso faz o script relatar "0
// atualizados" logo depois de atualizar 300.
await sql`
  UPDATE products SET category = 'VINHO', updated_at = now()
  WHERE category = 'VINHOS'
`;
const [{ count: restantes }] = await sql`
  SELECT COUNT(*)::text AS count FROM products WHERE category = 'VINHOS'
`;
console.log(
  `[migration] products.category atualizados: ${Number(antes) - Number(restantes)} (restam ${restantes} em 'VINHOS')`,
);

// Renomeia em vez de deletar+inserir: preserva o id da categoria caso algo
// passe a referenciá-la no futuro. Se 'VINHO' já existisse, o rename violaria
// o unique de name — daí o DELETE no ramo alternativo.
const [existeVinho] = await sql`
  SELECT COUNT(*)::text AS count FROM product_categories WHERE name = 'VINHO'
`;

if (existeVinho.count === "0") {
  await sql`
    UPDATE product_categories SET name = 'VINHO', updated_at = now()
    WHERE name = 'VINHOS'
  `;
  console.log("[migration] product_categories: 'VINHOS' renomeada para 'VINHO'.");
} else {
  await sql`DELETE FROM product_categories WHERE name = 'VINHOS'`;
  console.log("[migration] 'VINHO' já existia; linha 'VINHOS' removida.");
}

await sql`
  UPDATE category_goals SET category_name = 'VINHO'
  WHERE category_name = 'VINHOS'
`;
const [{ count: metasRestantes }] = await sql`
  SELECT COUNT(*)::text AS count FROM category_goals WHERE category_name = 'VINHOS'
`;
console.log(`[migration] category_goals ainda em 'VINHOS': ${metasRestantes}`);

const resumo = await sql`
  SELECT category, COUNT(*)::text AS n FROM products
  WHERE deleted_at IS NULL GROUP BY category ORDER BY COUNT(*) DESC
`;
console.log("[migration] Categorias após a unificação:");
for (const row of resumo) console.log(`  ${row.category}: ${row.n}`);
