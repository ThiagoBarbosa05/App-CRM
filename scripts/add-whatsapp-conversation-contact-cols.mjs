/**
 * Adiciona as colunas contact_name e contact_photo_url à tabela
 * whatsapp_conversations, usadas para exibir nome/foto do WhatsApp de
 * contatos que ainda não têm um cliente correspondente no CRM (canal QR
 * Code / Baileys).
 *
 * Uso (banco de produção):
 *   node scripts/add-whatsapp-conversation-contact-cols.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-whatsapp-conversation-contact-cols.mjs
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
  ALTER TABLE whatsapp_conversations
    ADD COLUMN IF NOT EXISTS contact_name text,
    ADD COLUMN IF NOT EXISTS contact_photo_url text
`;

console.log("[migration] Colunas contact_name e contact_photo_url adicionadas a whatsapp_conversations.");
