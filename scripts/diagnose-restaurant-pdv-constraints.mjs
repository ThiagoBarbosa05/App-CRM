/**
 * Diagnóstico do PDV Restaurante — SOMENTE LEITURA.
 *
 * Não altera nada. Roda antes de `create-restaurant-pdv-constraints.mjs` para
 * responder duas perguntas:
 *
 *   1. O índice `restaurant_cash_sessions_single_open` ainda existe? Ele foi
 *      criado global por status (`ON (status) WHERE status = 'aberto'`), o que
 *      permite UM ÚNICO caixa aberto no sistema inteiro — incompatível com o
 *      modelo multi-unidade que o código assume hoje. Ele não está declarado em
 *      `shared/schema.ts`, então o schema não conta essa história.
 *
 *   2. Os dados atuais aguentam as constraints planejadas? Um índice único ou
 *      um CHECK falha na criação se já houver linha violando. Melhor descobrir
 *      aqui do que num ALTER TABLE que aborta no meio.
 *
 * Uso:
 *   node scripts/diagnose-restaurant-pdv-constraints.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

/** Acumula os bloqueios que impedem a Fase 1 de aplicar o DDL. */
const blockers = [];

const section = (title) => {
  console.log(`\n${"─".repeat(72)}\n${title}\n${"─".repeat(72)}`);
};

const report = (label, rows, { blocking = false, empty = "nenhum" } = {}) => {
  if (rows.length === 0) {
    console.log(`  ✓ ${label}: ${empty}`);
    return;
  }
  console.log(`  ${blocking ? "✗" : "•"} ${label}: ${rows.length} registro(s)`);
  console.table(rows);
  if (blocking) blockers.push(`${label} (${rows.length})`);
};

// ── 1. Índices e constraints existentes ──────────────────────────────────────
section("1. Índices e CHECKs existentes nas tabelas do PDV");

const indexes = await sql`
  SELECT tablename, indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename LIKE 'restaurant_%'
  ORDER BY tablename, indexname
`;
console.table(indexes.map((i) => ({ tabela: i.tablename, indice: i.indexname })));

// Qualquer índice único parcial sobre sessões de caixa — o nome mudou pelo menos
// uma vez sem passar por script versionado, então procuramos pela forma, não
// pelo nome.
const sessionUniques = indexes.filter(
  (i) =>
    i.tablename === "restaurant_cash_sessions" &&
    i.indexdef.includes("UNIQUE") &&
    i.indexdef.includes("aberto"),
);

console.log("\n  Regra de unicidade do caixa aberto:");
if (sessionUniques.length === 0) {
  console.log(
    "  ⚠ NENHUM índice único parcial encontrado.\n" +
      "    → Nada no banco impede dois caixas abertos ao mesmo tempo. A garantia\n" +
      "      é só de aplicação (check-then-insert em openSession), que tem corrida.",
  );
} else {
  for (const idx of sessionUniques) {
    console.log(`  • ${idx.indexname}`);
    console.log(`    ${idx.indexdef}`);
  }
  console.log(
    "\n    Compare com o que o código assume: `getCurrentSession(userId, unitId)`\n" +
      "    filtra por usuário E unidade. Se o índice for só por `status`, existe\n" +
      "    um caixa no sistema inteiro; se for só por `opened_by`, um gestor não\n" +
      "    consegue ter caixa em duas unidades. Nenhum dos dois está declarado em\n" +
      "    shared/schema.ts — o comentário em :2466-2467 pode estar desatualizado.",
  );
}

const checks = await sql`
  SELECT rel.relname AS tabela, con.conname AS constraint_name,
         pg_get_constraintdef(con.oid) AS definicao
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname = 'public'
    AND rel.relname LIKE 'restaurant_%'
    AND con.contype = 'c'
  ORDER BY rel.relname, con.conname
`;
report("CHECKs já existentes", checks, { empty: "nenhum CHECK nas tabelas do PDV" });

// ── 2. Estado das sessões de caixa ───────────────────────────────────────────
section("2. Sessões de caixa abertas");

const openSessions = await sql`
  SELECT unit_id, opened_by, COUNT(*)::int AS sessoes_abertas
  FROM restaurant_cash_sessions
  WHERE status = 'aberto'
  GROUP BY unit_id, opened_by
  ORDER BY sessoes_abertas DESC
`;
report("Sessões abertas por (unit_id, opened_by)", openSessions, {
  empty: "nenhuma sessão aberta agora",
});

const dupSessions = openSessions.filter((s) => s.sessoes_abertas > 1);
report("Operadores com MAIS DE UMA sessão aberta", dupSessions, { blocking: true });

const sessionsNoUnit = await sql`
  SELECT COUNT(*)::int AS total
  FROM restaurant_cash_sessions
  WHERE unit_id IS NULL
`;
console.log(`  • Sessões com unit_id NULL (legado): ${sessionsNoUnit[0].total}`);

// ── 3. Comandas duplicadas na mesma mesa ─────────────────────────────────────
section("3. Comandas abertas duplicadas por mesa (a corrida já aconteceu?)");

const dupOrders = await sql`
  SELECT unit_id, table_number, COUNT(*)::int AS comandas_abertas,
         array_agg(id) AS ids
  FROM restaurant_orders
  WHERE status = 'aberta'
  GROUP BY unit_id, table_number
  HAVING COUNT(*) > 1
  ORDER BY comandas_abertas DESC
`;
report(
  "Mesas com mais de uma comanda aberta — BLOQUEIA o índice único",
  dupOrders,
  { blocking: true },
);

// ── 4. Fechamento duplo: pagamentos divergentes do total ─────────────────────
section("4. Comandas fechadas com soma de pagamentos ≠ total");

const paymentMismatch = await sql`
  SELECT o.id, o.order_number, o.table_number, o.unit_id,
         o.total::text AS total_comanda,
         COALESCE(SUM(p.amount), 0)::text AS total_pagamentos,
         (COALESCE(SUM(p.amount), 0) - o.total)::text AS diferenca,
         COUNT(p.id)::int AS qtd_pagamentos
  FROM restaurant_orders o
  LEFT JOIN restaurant_order_payments p ON p.order_id = o.id
  WHERE o.status = 'fechada' AND o.total IS NOT NULL
  GROUP BY o.id, o.order_number, o.table_number, o.unit_id, o.total
  HAVING ABS(COALESCE(SUM(p.amount), 0) - o.total) > 0.01
  ORDER BY ABS(COALESCE(SUM(p.amount), 0) - o.total) DESC
  LIMIT 50
`;
report(
  "Comandas com pagamento divergente (sintoma de fechamento duplo)",
  paymentMismatch,
  { empty: "todas as comandas fechadas batem com seus pagamentos" },
);

// ── 5. unit_id nulo — bloqueia índices por unidade ───────────────────────────
section("5. Registros sem unidade (legado)");

const nullUnits = await sql`
  SELECT 'restaurant_orders' AS tabela,
         COUNT(*) FILTER (WHERE unit_id IS NULL)::int AS sem_unidade,
         COUNT(*) FILTER (WHERE unit_id IS NULL AND status = 'aberta')::int AS sem_unidade_abertas,
         COUNT(*)::int AS total
  FROM restaurant_orders
  UNION ALL
  SELECT 'restaurant_tables',
         COUNT(*) FILTER (WHERE unit_id IS NULL)::int,
         COUNT(*) FILTER (WHERE unit_id IS NULL AND is_active = true)::int,
         COUNT(*)::int
  FROM restaurant_tables
`;
console.table(nullUnits);
console.log(
  "  → unit_id NULL não colide em índice único (NULLs são distintos no PG),\n" +
    "    então o índice CRIA normalmente — mas essas linhas ficam SEM a garantia.\n" +
    "    Relevante para decidir o comportamento do guard de unidade na Fase 2.",
);

// ── 6. Violações dos CHECKs planejados ───────────────────────────────────────
section("6. Dados que violariam os CHECKs planejados");

const badQuantity = await sql`
  SELECT id, order_id, name, quantity, unit_price::text
  FROM restaurant_order_items
  WHERE quantity <= 0
  LIMIT 50
`;
report("Itens com quantity <= 0", badQuantity, { blocking: true });

const badUnitPrice = await sql`
  SELECT id, order_id, name, unit_price::text
  FROM restaurant_order_items
  WHERE unit_price < 0
  LIMIT 50
`;
report("Itens com unit_price < 0", badUnitPrice, { blocking: true });

const badDiscount = await sql`
  SELECT id, order_number, discount_percent::text, discount_amount::text
  FROM restaurant_orders
  WHERE discount_percent IS NOT NULL
    AND (discount_percent < 0 OR discount_percent > 100)
  LIMIT 50
`;
report("Comandas com discount_percent fora de 0..100", badDiscount, { blocking: true });

const badPayment = await sql`
  SELECT id, order_id, method, amount::text
  FROM restaurant_order_payments
  WHERE amount <= 0
  LIMIT 50
`;
report("Pagamentos com amount <= 0", badPayment, { blocking: true });

const badMovement = await sql`
  SELECT id, session_id, type, amount::text
  FROM restaurant_cash_movements
  WHERE amount <= 0
  LIMIT 50
`;
report("Movimentos de caixa com amount <= 0", badMovement, { blocking: true });

// ── 7. NaN gravado em coluna numeric ─────────────────────────────────────────
section("7. Valores NaN (corrompem toda soma da sessão)");

console.log(
  "  O Postgres ACEITA 'NaN' numa coluna numeric, e 'NaN' > 0 é verdadeiro —\n" +
    "  um CHECK (amount > 0) NÃO pega. Uma vez gravado, qualquer SUM() daquela\n" +
    "  sessão vira NaN e o caixa fica sem conferência possível.\n",
);

const nanPayments = await sql`
  SELECT id, order_id, method, amount::text
  FROM restaurant_order_payments
  WHERE amount = 'NaN'::numeric
  LIMIT 50
`;
report("Pagamentos com amount = NaN", nanPayments, { blocking: true });

const nanMovements = await sql`
  SELECT id, session_id, type, amount::text
  FROM restaurant_cash_movements
  WHERE amount = 'NaN'::numeric
  LIMIT 50
`;
report("Movimentos com amount = NaN", nanMovements, { blocking: true });

const nanOrders = await sql`
  SELECT id, order_number, total::text, subtotal::text, discount_amount::text
  FROM restaurant_orders
  WHERE total = 'NaN'::numeric
     OR subtotal = 'NaN'::numeric
     OR discount_amount = 'NaN'::numeric
     OR service_fee_amount = 'NaN'::numeric
  LIMIT 50
`;
report("Comandas com algum total NaN", nanOrders, { blocking: true });

const nanItems = await sql`
  SELECT id, order_id, name, unit_price::text
  FROM restaurant_order_items
  WHERE unit_price = 'NaN'::numeric
  LIMIT 50
`;
report("Itens com unit_price = NaN", nanItems, { blocking: true });

// ── Veredito ─────────────────────────────────────────────────────────────────
section("Veredito");

if (blockers.length === 0) {
  console.log(
    "  ✓ Nenhum dado impede a criação das constraints.\n" +
      "    Pode rodar: node scripts/create-restaurant-pdv-constraints.mjs",
  );
} else {
  console.log("  ✗ Corrigir antes de aplicar o DDL:\n");
  for (const b of blockers) console.log(`      - ${b}`);
  console.log(
    "\n    O script de constraints vai FALHAR enquanto essas linhas existirem.",
  );
}

console.log(
  "\n  Decisão pendente independente dos dados: o que fazer com\n" +
    "  restaurant_cash_sessions_single_open (ver seção 1).\n",
);
