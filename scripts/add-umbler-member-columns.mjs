/**
 * Adiciona as colunas `umbler_member_id` e `umbler_member_name` à tabela `users`.
 * Guarda o vínculo manual entre um vendedor do CRM e seu atendente
 * correspondente no Umbler Talk (não é possível casar automaticamente
 * pois as duas plataformas usam e-mails diferentes).
 *
 * Uso (banco de produção):
 *   node scripts/add-umbler-member-columns.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-umbler-member-columns.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL ou TEST_DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS umbler_member_id text
`;

await sql`
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS umbler_member_name text
`;

console.log(
  "[migration] Colunas umbler_member_id e umbler_member_name adicionadas à tabela users.",
);
