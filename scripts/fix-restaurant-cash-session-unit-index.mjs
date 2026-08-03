/**
 * Migra a unicidade da sessão de caixa de "por operador POR UNIDADE" para
 * "por UNIDADE" — o caixa passa a ser um recurso compartilhado entre
 * operadores da mesma unidade (conta Bling), não pessoal de quem o abriu.
 *
 * Motivo: `getCurrentSession`/`assertSessionOpen` deixaram de filtrar por
 * `opened_by`. Um vendedor vinculado à unidade agora precisa enxergar e
 * operar o caixa aberto por outro operador (ex.: um gestor) da mesma unidade.
 *
 * Diagnóstico primeiro: se já existirem 2+ caixas abertos simultâneos na
 * mesma unidade, o novo índice único falha ao ser criado — o script reporta
 * o conflito e não prossegue sozinho (decisão de negócio: qual caixa
 * fechar/mesclar cabe a um humano).
 *
 * Idempotente: pode rodar mais de uma vez.
 *
 * Uso:
 *   node scripts/fix-restaurant-cash-session-unit-index.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

console.log("\nDiagnóstico — caixas abertos simultâneos na mesma unidade\n");

// Alguns endpoints compatíveis com a API HTTP do Neon devolvem `fields: null`
// para SELECTs sem linhas. O driver espera um array e falha em `fields.map()`.
// A agregação garante uma linha mesmo quando não existem conflitos.
const [{ conflicts }] = await sql`
  SELECT COALESCE(json_agg(conflict ORDER BY conflict.unit_id), '[]'::json) AS conflicts
  FROM (
    SELECT COALESCE(unit_id::text, '-') AS unit_id, COUNT(*) AS n
    FROM restaurant_cash_sessions
    WHERE status = 'aberto'
    GROUP BY COALESCE(unit_id::text, '-')
    HAVING COUNT(*) > 1
  ) AS conflict
`;

if (conflicts.length > 0) {
  console.error("  ! Encontrados conflitos — o índice único por unidade não pode ser criado:");
  for (const c of conflicts) {
    const rows = await sql`
      SELECT id, opened_by, unit_id, opened_at
      FROM restaurant_cash_sessions
      WHERE status = 'aberto' AND COALESCE(unit_id::text, '-') = ${c.unit_id}
      ORDER BY opened_at
    `;
    console.error(`    unidade ${c.unit_id}: ${c.n} caixas abertos`);
    for (const r of rows) {
      console.error(`      - ${r.id} (opened_by=${r.opened_by}, opened_at=${r.opened_at})`);
    }
  }
  console.error(
    "\n  Feche ou mescle manualmente os caixas conflitantes antes de rodar este script novamente.\n",
  );
  process.exit(1);
}

console.log("  = nenhum conflito encontrado\n");

console.log("Índice único — um caixa aberto por UNIDADE\n");

// Busca por FORMA, não por nome fixo: já existiu mais de uma versão desta
// regra (global por status, por opened_by apenas, por opened_by+unit_id) e o
// nome mudou entre elas sem sincronizar o Drizzle — mesmo padrão usado em
// scripts/create-restaurant-pdv-constraints.mjs. Remove qualquer índice único
// parcial "aberto" que não seja o canônico que estamos criando agora.
const [{ indexes: staleSessionIndexes }] = await sql`
  SELECT COALESCE(json_agg(candidate ORDER BY candidate.indexname), '[]'::json) AS indexes
  FROM (
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'restaurant_cash_sessions'
      AND indexdef LIKE '%UNIQUE%'
      AND indexdef LIKE '%aberto%'
      AND indexname <> 'restaurant_cash_sessions_one_open_per_unit'
  ) AS candidate
`;

for (const idx of staleSessionIndexes) {
  console.log(`  - removendo ${idx.indexname}`);
  console.log(`    (era: ${idx.indexdef})`);
  await sql.query(`DROP INDEX IF EXISTS ${idx.indexname}`);
}
if (staleSessionIndexes.length === 0) {
  console.log("  = nenhum índice antigo encontrado");
}

// COALESCE porque índice único não deduplica NULLs: sem ele, sessões legadas
// sem unidade escapariam da regra.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS restaurant_cash_sessions_one_open_per_unit
    ON restaurant_cash_sessions (COALESCE(unit_id, '-'))
    WHERE status = 'aberto'
`;
console.log("  + restaurant_cash_sessions_one_open_per_unit");

console.log("\n[migration] Índice de unicidade do caixa agora é por unidade.\n");
