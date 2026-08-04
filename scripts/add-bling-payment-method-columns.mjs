/**
 * Formas de pagamento do Bling no fechamento de comanda.
 *
 * Guarda em cada pagamento da comanda a forma de pagamento escolhida na conta
 * Bling da unidade, para o pedido de venda sair com `parcelas[].formaPagamento`.
 * Colunas nullable: pagamentos antigos seguem sem forma (parcela sem
 * formaPagamento, comportamento atual do Bling).
 *
 * Idempotente: pode rodar mais de uma vez.
 *
 * Uso:
 *   node scripts/add-bling-payment-method-columns.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`ALTER TABLE restaurant_order_payments ADD COLUMN IF NOT EXISTS bling_payment_method_id text`;
console.log("  + bling_payment_method_id");
await sql`ALTER TABLE restaurant_order_payments ADD COLUMN IF NOT EXISTS bling_payment_method_description text`;
console.log("  + bling_payment_method_description");

console.log("\n[migration] Colunas de forma de pagamento Bling prontas.\n");
