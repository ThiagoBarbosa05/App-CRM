/**
 * Cria a tabela sms_individual_messages, usada para registrar o histórico e
 * auditoria de envios avulsos de SMS (fora de campanhas) feitos pela aba SMS
 * da página Marketing.
 *
 * Uso:
 *   node scripts/create-sms-individual-messages-table.mjs
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
  CREATE TABLE IF NOT EXISTS sms_individual_messages (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id varchar REFERENCES clients(id) ON DELETE SET NULL,
    phone text NOT NULL,
    message text NOT NULL,
    status text NOT NULL,
    twilio_sid text,
    error_message text,
    sent_by varchar NOT NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now()
  )
`;

console.log("[migration] Tabela sms_individual_messages criada (ou já existente).");
