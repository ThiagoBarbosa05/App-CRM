/**
 * Cria a tabela whatsapp_channel_qr_readers: permissão granular e
 * independente de whatsapp_channel_members — define quais usuários podem
 * ler/gerar o QR Code de conexão de um canal do qual não são donos.
 *
 * Uso:
 *   node scripts/create-whatsapp-channel-qr-readers-table.mjs
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
  CREATE TABLE IF NOT EXISTS whatsapp_channel_qr_readers (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id integer NOT NULL REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (channel_id, user_id)
  )
`;
console.log("[migration] Tabela whatsapp_channel_qr_readers criada (ou já existente).");
