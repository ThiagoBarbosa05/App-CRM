/**
 * Adiciona a coluna `deleted_at` à tabela `whatsapp_channels`, habilitando
 * soft delete de canais (preserva o histórico de conversas/mensagens em vez
 * de apagar a linha, o que travava com erro de FK em
 * whatsapp_channel_connection_events para canais Evolution já conectados).
 *
 * Uso (banco de produção):
 *   node scripts/add-whatsapp-channels-deleted-at.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-whatsapp-channels-deleted-at.mjs
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
  ALTER TABLE whatsapp_channels
    ADD COLUMN IF NOT EXISTS deleted_at timestamp
`;

console.log("[migration] Coluna deleted_at adicionada à tabela whatsapp_channels.");
