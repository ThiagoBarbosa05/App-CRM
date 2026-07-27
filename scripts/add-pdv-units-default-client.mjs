/**
 * Consumidor Final da unidade — usado no envio de pedido de venda ao Bling
 * quando a comanda fecha sem cliente vinculado.
 *
 * Uso:
 *   node scripts/add-pdv-units-default-client.mjs
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
  ADD COLUMN IF NOT EXISTS default_client_id varchar REFERENCES clients(id)
`;
console.log(
  "[migration] Coluna default_client_id adicionada em pdv_units (ou já existente).",
);

console.log("[migration] Concluído.");
