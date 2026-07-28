/**
 * Vendedor padrão da unidade — usado como fallback do "vendedor" ao enviar
 * pedido de venda ao Bling quando o garçom que fechou a comanda não tem
 * mapeamento de vendedor Bling para a conexão da unidade (mesmo papel que
 * default_client_id cumpre para o contato).
 *
 * Coluna nullable, sem backfill.
 *
 * Uso:
 *   node scripts/add-pdv-unit-default-seller-id.mjs
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
  ALTER TABLE pdv_units
  ADD COLUMN IF NOT EXISTS default_seller_id varchar REFERENCES users(id)
`;
console.log("[migration] Coluna pdv_units.default_seller_id criada (ou já existente).");

console.log("[migration] Concluído.");
