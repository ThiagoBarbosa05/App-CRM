/**
 * Adiciona a coluna `status_reason` à tabela `whatsapp_messages`, para
 * registrar o motivo semântico de uma falha de envio (ex.: "account_restricted"
 * para o erro 463 do Baileys — conta restrita pelo WhatsApp), evitando que o
 * frontend ofereça "Reenviar" numa condição que só piora a restrição.
 *
 * Uso (banco de produção):
 *   node scripts/add-message-status-reason.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-message-status-reason.mjs
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
  ALTER TABLE whatsapp_messages
    ADD COLUMN IF NOT EXISTS status_reason text
`;

console.log("[migration] Coluna status_reason adicionada à tabela whatsapp_messages.");
