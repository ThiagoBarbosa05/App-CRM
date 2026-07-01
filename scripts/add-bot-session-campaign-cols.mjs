/**
 * Adiciona as colunas campaign_id e completion_reason à tabela
 * whatsapp_bot_sessions, usadas para vincular sessões de bot à campanha de
 * marketing que as iniciou e registrar o motivo de finalização.
 *
 * Uso (banco de produção):
 *   node scripts/add-bot-session-campaign-cols.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-bot-session-campaign-cols.mjs
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
    ADD COLUMN IF NOT EXISTS campaign_id varchar REFERENCES whatsapp_campaigns(id),
    ADD COLUMN IF NOT EXISTS completion_reason text
`;

console.log("[migration] Colunas campaign_id e completion_reason adicionadas.");
