/**
 * Diagnóstico SOMENTE LEITURA da conferência de caixa.
 *
 * Procura pagamentos que existem no banco mas não entram em nenhuma sessão de
 * caixa — a causa do "caixa não bate". Um pagamento fica órfão quando a comanda
 * dele não é `fechada` com `cash_session_id`:
 *
 *   1. Comanda CANCELADA com pagamento registrado. Era possível até a checagem
 *      adicionada em `forceCancelOrder`; se foi em dinheiro, a nota está na
 *      gaveta mas o esperado não conta → SOBRA de caixa.
 *   2. Comanda MESCLADA com pagamento. `mergeOrders` bloqueia, mas dados
 *      anteriores a esse bloqueio podem existir.
 *   3. Comanda FECHADA sem `cash_session_id` — anterior à implantação do caixa.
 *      Esperado e sem conserto: não há sessão a que pertencer.
 *
 * Não altera nada. Só imprime.
 *
 * Uso:
 *   node scripts/diagnose-cash-session-orphan-payments.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida no .env");
  process.exit(1);
}

const sql = neon(url);

const brl = (v) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const rows = await sql`
  SELECT
    o.status,
    o.id            AS order_id,
    o.order_number,
    o.table_number,
    o.closed_at,
    o.cash_session_id,
    p.method,
    p.amount
  FROM restaurant_order_payments p
  JOIN restaurant_orders o ON o.id = p.order_id
  WHERE o.status <> 'fechada' OR o.cash_session_id IS NULL
  ORDER BY o.closed_at DESC NULLS LAST
`;

if (rows.length === 0) {
  console.log("Nenhum pagamento órfão. A conferência de caixa está íntegra.");
  process.exit(0);
}

// O dinheiro é o que dói: cartão e Pix órfãos sujam o relatório, mas dinheiro
// órfão vira nota física na gaveta sem contrapartida no esperado.
const buckets = new Map();
for (const r of rows) {
  const key = r.cash_session_id === null && r.status === "fechada" ? "pre_caixa" : r.status;
  const b = buckets.get(key) ?? { total: 0, cash: 0, orders: new Set() };
  b.total += Number(r.amount);
  if (r.method === "dinheiro") b.cash += Number(r.amount);
  b.orders.add(r.order_number);
  buckets.set(key, b);
}

const LABELS = {
  cancelada: "Comandas CANCELADAS com pagamento (afeta o caixa)",
  mesclada: "Comandas MESCLADAS com pagamento (afeta o caixa)",
  aberta: "Comandas ABERTAS com pagamento parcial (normal se o turno está em curso)",
  pre_caixa: "Comandas fechadas antes do caixa existir (esperado, sem conserto)",
};

console.log(`\n${rows.length} pagamento(s) fora de qualquer conferência:\n`);
for (const [key, b] of buckets) {
  console.log(`  ${LABELS[key] ?? key}`);
  console.log(`    comandas: ${[...b.orders].sort((a, z) => a - z).join(", ")}`);
  console.log(`    total: ${brl(b.total)}  —  em dinheiro: ${brl(b.cash)}\n`);
}

const impact = ["cancelada", "mesclada"].reduce(
  (sum, k) => sum + (buckets.get(k)?.cash ?? 0),
  0,
);
if (impact > 0) {
  console.log(
    `Sobra de caixa acumulada explicada por isto: ${brl(impact)}.\n` +
      `É dinheiro que entrou na gaveta e nenhuma sessão contabilizou.\n`,
  );
}
