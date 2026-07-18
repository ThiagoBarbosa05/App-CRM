/**
 * Adiciona as colunas channel_id e error_message à tabela
 * whatsapp_bot_sessions, usadas para snapshot do canal de disparo e para
 * persistir o motivo de falha quando uma sessão termina com status "failed".
 *
 * Uso (banco de produção):
 *   node scripts/add-bot-session-error-tracking-cols.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-bot-session-error-tracking-cols.mjs
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
  ALTER TABLE whatsapp_bot_sessions
    ADD COLUMN IF NOT EXISTS channel_id integer REFERENCES whatsapp_channels(id),
    ADD COLUMN IF NOT EXISTS error_message text
`;

console.log("[migration] Colunas channel_id e error_message adicionadas a whatsapp_bot_sessions.");
