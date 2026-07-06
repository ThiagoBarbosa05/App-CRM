/**
 * Cria a tabela cpf_verification_logs: registro de auditoria de cada consulta
 * de CPF na Assertiva (quem consultou, quando, sucesso/erro, campos aplicados).
 *
 * Uso:
 *   node scripts/create-cpf-verification-logs-table.mjs
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
  CREATE TABLE IF NOT EXISTS cpf_verification_logs (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id varchar NOT NULL REFERENCES clients(id),
    user_id varchar NOT NULL REFERENCES users(id),
    status text NOT NULL,
    error_message text,
    fields_updated text[],
    created_at timestamp NOT NULL DEFAULT now()
  )
`;

console.log("[migration] Tabela cpf_verification_logs criada (ou já existente).");
