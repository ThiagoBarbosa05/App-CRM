/**
 * Adiciona colunas de rastreamento de template pendente à tabela
 * whatsapp_bot_sessions, usadas pelo nó send_template.
 *
 * Uso (banco de produção):
 *   node scripts/add-bot-session-template-cols.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-bot-session-template-cols.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = 'postgresql://neondb_owner:npg_L0HdjTg2seph@ep-plain-waterfall-adekkzn1.c-2.us-east-1.aws.neon.tech/neondb'
if (!url) {
  console.error("Defina DATABASE_URL ou TEST_DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  ALTER TABLE whatsapp_bot_sessions
    ADD COLUMN IF NOT EXISTS pending_message_id varchar,
    ADD COLUMN IF NOT EXISTS response_deadline_at timestamp
`;

console.log("[migration] Colunas pending_message_id e response_deadline_at adicionadas.");
