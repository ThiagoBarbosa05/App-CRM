/**
 * Preenche `unit_id` nas tabelas do PDV que ficaram nulas de antes do
 * multi-unidade.
 *
 * Por que importa: o guard de unidade trata `unit_id IS NULL` como legado e
 * deixa passar, para não tornar o histórico inacessível. Enquanto houver
 * comanda aberta sem unidade, essa exceção fica valendo para operação do dia a
 * dia — e uma exceção permanente deixa de ser exceção.
 *
 * Só roda automaticamente quando existe EXATAMENTE UMA unidade ativa: com duas
 * ou mais, não há como adivinhar a qual cada registro pertence, e chutar aqui
 * significaria receita atribuída ao restaurante errado.
 *
 * Idempotente. Altera dados — leia a saída do diagnóstico antes.
 *
 * Uso:
 *   node scripts/backfill-restaurant-pdv-unit-id.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

const units = await sql`
  SELECT id, name FROM pdv_units WHERE is_active = true ORDER BY created_at
`;

if (units.length === 0) {
  console.error("Nenhuma unidade PDV ativa. Crie a unidade antes do backfill.");
  process.exit(1);
}

if (units.length > 1) {
  console.error(
    `Há ${units.length} unidades ativas:\n` +
      units.map((u) => `  - ${u.name} (${u.id})`).join("\n") +
      "\n\nO backfill automático seria um chute sobre a qual unidade cada" +
      "\nregistro pertence. Atribua manualmente e rode o diagnóstico de novo.",
  );
  process.exit(1);
}

const unit = units[0];
console.log(`\nUnidade alvo: ${unit.name} (${unit.id})\n`);

const tables = [
  "restaurant_orders",
  "restaurant_tables",
  "restaurant_menu_items",
  "restaurant_cash_sessions",
];

for (const table of tables) {
  const rows = await sql(
    `UPDATE ${table} SET unit_id = $1 WHERE unit_id IS NULL RETURNING id`,
    [unit.id],
  );
  console.log(`  ${table}: ${rows.length} registro(s) atualizados`);
}

console.log(
  "\n[migration] Backfill concluído. Rode o diagnóstico novamente para" +
    "\nconfirmar que não sobrou unit_id nulo.\n",
);
