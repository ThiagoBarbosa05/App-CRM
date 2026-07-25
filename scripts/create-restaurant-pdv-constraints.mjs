/**
 * Constraints de integridade do PDV Restaurante.
 *
 * Puramente aditivo: cria índices e CHECKs, não altera nenhuma linha. Se algum
 * dado atual violar uma constraint, a criação falha — rode antes
 * `node scripts/diagnose-restaurant-pdv-constraints.mjs`, que reporta
 * exatamente quais linhas atrapalham.
 *
 * Por que no banco e não só na aplicação: as regras abaixo protegem contra
 * CORRIDA. `openOrder` faz check-then-insert; duas aberturas simultâneas passam
 * as duas pela checagem. Só o índice único resolve, porque só ele é avaliado
 * dentro do commit.
 *
 * Idempotente: pode rodar mais de uma vez.
 *
 * Uso:
 *   node scripts/create-restaurant-pdv-constraints.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

/** `ALTER TABLE ... ADD CONSTRAINT` não aceita `IF NOT EXISTS`. */
async function addCheck(table, name, expression) {
  const [{ exists }] = await sql`
    SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conname = ${name}) AS exists
  `;
  if (exists) {
    console.log(`  = ${name} (já existe)`);
    return;
  }
  await sql(`ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${expression})`);
  console.log(`  + ${name}`);
}

console.log("\nÍndices únicos parciais — uma comanda aberta por mesa\n");

// Mesa cadastrada: a chave é o próprio `table_id`.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS restaurant_orders_one_open_per_table
    ON restaurant_orders (table_id)
    WHERE status = 'aberta' AND table_id IS NOT NULL
`;
console.log("  + restaurant_orders_one_open_per_table");

// Mesa avulsa (sem `table_id`): a chave é (unidade, número). O COALESCE existe
// porque índice único NÃO deduplica NULLs — sem ele, duas avulsas sem unidade
// voltariam a coexistir, que é exatamente o bug que estamos fechando.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS restaurant_orders_one_open_per_loose_table
    ON restaurant_orders (COALESCE(unit_id, '-'), table_number)
    WHERE status = 'aberta' AND table_id IS NULL
`;
console.log("  + restaurant_orders_one_open_per_loose_table");

console.log("\nUnicidade da sessão de caixa — um caixa por operador POR UNIDADE\n");

// A regra anterior existia só em script, com nome que já mudou pelo menos uma
// vez e sem declaração no Drizzle. Se for global por `status`, existe um caixa
// no sistema inteiro; se for só por `opened_by`, o gestor não consegue abrir
// caixa em duas unidades. Nenhuma das duas é o que o código assume
// (`getCurrentSession` filtra por usuário E unidade), então trocamos pela forma
// correta — procurando pela FORMA, não pelo nome.
const staleSessionIndexes = await sql`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'restaurant_cash_sessions'
    AND indexdef LIKE '%UNIQUE%'
    AND indexdef LIKE '%aberto%'
    AND indexname <> 'restaurant_cash_sessions_one_open_per_user_unit'
`;

for (const idx of staleSessionIndexes) {
  console.log(`  - removendo ${idx.indexname}`);
  console.log(`    (era: ${idx.indexdef})`);
  await sql(`DROP INDEX IF EXISTS ${idx.indexname}`);
}

// COALESCE porque índice único não deduplica NULLs: sem ele, sessões legadas
// sem unidade escapariam da regra justamente enquanto o backfill não roda.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS restaurant_cash_sessions_one_open_per_user_unit
    ON restaurant_cash_sessions (opened_by, COALESCE(unit_id, '-'))
    WHERE status = 'aberto'
`;
console.log("  + restaurant_cash_sessions_one_open_per_user_unit");

console.log("\nCHECKs de integridade\n");

await addCheck(
  "restaurant_order_items",
  "restaurant_order_items_quantity_positive",
  "quantity > 0",
);

// `unit_price <> 'NaN'` não é paranoia: o Postgres aceita 'NaN' em coluna
// numeric e `'NaN' > 0` é VERDADEIRO, então um CHECK só de sinal deixa passar
// justamente o valor que envenena toda soma posterior.
await addCheck(
  "restaurant_order_items",
  "restaurant_order_items_unit_price_valid",
  "unit_price >= 0 AND unit_price <> 'NaN'::numeric",
);

await addCheck(
  "restaurant_order_payments",
  "restaurant_order_payments_amount_valid",
  "amount > 0 AND amount <> 'NaN'::numeric",
);

await addCheck(
  "restaurant_cash_movements",
  "restaurant_cash_movements_amount_valid",
  "amount > 0 AND amount <> 'NaN'::numeric",
);

await addCheck(
  "restaurant_orders",
  "restaurant_orders_discount_percent_range",
  "discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)",
);

await addCheck(
  "restaurant_orders",
  "restaurant_orders_discount_amount_valid",
  "discount_amount IS NULL OR (discount_amount >= 0 AND discount_amount <> 'NaN'::numeric)",
);

await addCheck(
  "restaurant_orders",
  "restaurant_orders_totals_valid",
  "(subtotal IS NULL OR (subtotal >= 0 AND subtotal <> 'NaN'::numeric)) AND " +
    "(total IS NULL OR (total >= 0 AND total <> 'NaN'::numeric)) AND " +
    "(service_fee_amount IS NULL OR (service_fee_amount >= 0 AND service_fee_amount <> 'NaN'::numeric))",
);

await addCheck(
  "restaurant_cash_sessions",
  "restaurant_cash_sessions_opening_float_valid",
  "opening_float >= 0 AND opening_float <> 'NaN'::numeric",
);

console.log("\n[migration] Constraints do PDV aplicadas.\n");
