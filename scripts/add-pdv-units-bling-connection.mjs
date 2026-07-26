/**
 * Vínculo entre unidade PDV e conta Bling: a coluna já era declarada em
 * shared/schema.ts (pdvUnits.blingConnectionId), mas nunca chegou ao banco.
 * É ela que define quais produtos do CRM aparecem no PDV daquela unidade.
 *
 * Uso:
 *   node scripts/add-pdv-units-bling-connection.mjs
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
  ADD COLUMN IF NOT EXISTS bling_connection_id varchar
`;
console.log(
  "[migration] Coluna bling_connection_id adicionada em pdv_units (ou já existente).",
);

console.log("[migration] Concluído.");
