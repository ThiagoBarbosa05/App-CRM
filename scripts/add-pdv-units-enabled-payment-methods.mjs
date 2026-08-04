/**
 * Formas de pagamento Bling liberadas por unidade PDV.
 *
 * O admin escolhe, nas configurações da unidade, quais formas de pagamento da
 * conta Bling aparecem no fechamento de comanda. `NULL` (padrão) = todas as
 * formas ativas da conta — comportamento anterior preservado.
 *
 * Idempotente: pode rodar mais de uma vez.
 *
 * Uso:
 *   node scripts/add-pdv-units-enabled-payment-methods.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`ALTER TABLE pdv_units ADD COLUMN IF NOT EXISTS enabled_bling_payment_method_ids jsonb`;
console.log("  + enabled_bling_payment_method_ids");

console.log("\n[migration] Formas de pagamento por unidade prontas.\n");
