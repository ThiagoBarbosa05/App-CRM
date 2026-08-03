/**
 * Conferência do pedido de venda no Bling + resgate do status de sync.
 *
 * Três coisas:
 *
 * 1. Colunas de conferência em `restaurant_orders`. O pedido passa a ser lido
 *    de volta do Bling depois de criado, para comparar o total dele com o
 *    total da comanda. O resultado é um eixo SEPARADO de `bling_sync_status`:
 *    divergência não pode virar `erro`, senão o cron re-POSTa e duplica o
 *    pedido — dinheiro real.
 *
 * 2. CHECK de `restaurant_order_bling_sync_log.result` recriado com os dois
 *    resultados novos (`conferido`, `divergente`). Sem isso o INSERT do
 *    conferidor estoura.
 *
 * 3. Backfill do bug do `pendente`: `closeOrder` nunca setava
 *    `bling_sync_status`, e o cron filtra `IN ('pendente','erro')` — comanda
 *    cuja primeira tentativa não gravou nada ficava NULL e sumia do retry
 *    para sempre.
 *
 * Idempotente: pode rodar mais de uma vez.
 *
 * Uso:
 *   node scripts/add-restaurant-order-bling-check-columns.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

console.log("\nDiagnóstico — comandas fechadas por status de sincronização\n");

const porStatus = await sql`
  SELECT COALESCE(bling_sync_status, '(null)') AS status, COUNT(*) AS n
  FROM restaurant_orders
  WHERE status = 'fechada'
  GROUP BY bling_sync_status
  ORDER BY 1
`;
if (porStatus.length === 0) {
  console.log("  = nenhuma comanda fechada ainda");
} else {
  for (const row of porStatus) {
    console.log(`  ${String(row.status).padEnd(12)} ${row.n}`);
  }
}

// Alguns endpoints compatíveis com a API HTTP do Neon devolvem `fields: null`
// para SELECTs sem linhas. O driver espera um array e falha em `fields.map()`.
// A agregação garante uma linha mesmo quando nenhuma unidade corresponde.
const [{ names: semConsumidorFinal }] = await sql`
  SELECT COALESCE(
    json_agg(name ORDER BY name),
    '[]'::json
  ) AS names
  FROM pdv_units
  WHERE is_active AND bling_connection_id IS NOT NULL AND default_client_id IS NULL
`;
if (semConsumidorFinal.length > 0) {
  console.log("\n  ! Unidades SEM Consumidor Final configurado — todo pedido");
  console.log("    dessas unidades será bloqueado antes de chegar ao Bling:");
  for (const name of semConsumidorFinal) console.log(`      - ${name}`);
  console.log("    Configure em PDV → Configurações → Unidades.");
}

console.log("\nColunas de conferência em restaurant_orders\n");

// Todas nullable e sem default: ALTER instantâneo, sem reescrever a tabela.
await sql`ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_sales_order_number text`;
console.log("  + bling_sales_order_number");
await sql`ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_check_status text`;
console.log("  + bling_check_status");
await sql`ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_check_detail text`;
console.log("  + bling_check_detail");
await sql`ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_checked_at timestamp`;
console.log("  + bling_checked_at");

await sql`ALTER TABLE restaurant_orders DROP CONSTRAINT IF EXISTS restaurant_orders_bling_check_status_check`;
await sql`
  ALTER TABLE restaurant_orders
  ADD CONSTRAINT restaurant_orders_bling_check_status_check
  CHECK (bling_check_status IS NULL OR bling_check_status IN ('ok','divergente','erro_conferencia'))
`;
console.log("  + CHECK de bling_check_status");

console.log("\nCHECK do log de sincronização\n");

// O CHECK atual só aceita enviado|bloqueado|erro; o conferidor grava
// `conferido`/`divergente` e estouraria. Recriado, não apenas dropado.
await sql`ALTER TABLE restaurant_order_bling_sync_log DROP CONSTRAINT IF EXISTS restaurant_order_bling_sync_log_result_check`;
await sql`
  ALTER TABLE restaurant_order_bling_sync_log
  ADD CONSTRAINT restaurant_order_bling_sync_log_result_check
  CHECK (result IN ('enviado','bloqueado','erro','conferido','divergente'))
`;
console.log("  + result aceita conferido/divergente");

console.log("\nResgate das comandas perdidas pelo bug do 'pendente'\n");

// `bloqueado` fica de fora de propósito: o motivo do bloqueio (configuração)
// não se resolve sozinho, então retentar só queimaria tentativas. Para essas,
// o caminho é o botão "Reenviar" na tela, que zera o contador.
const [{ count: resgatadas }] = await sql`
  WITH updated AS (
    UPDATE restaurant_orders
    SET bling_sync_status = 'pendente'
    WHERE status = 'fechada' AND bling_sync_status IS NULL
    RETURNING id
  )
  SELECT COUNT(*)::integer AS count FROM updated
`;
console.log(
  resgatadas > 0
    ? `  + ${resgatadas} comanda(s) devolvida(s) à fila do cron`
    : "  = nenhuma comanda órfã encontrada",
);

console.log("\n[migration] Conferência do pedido Bling pronta.\n");
