import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

async function main() {
  console.log('Removendo conversas de status/broadcast (phone = "status")...');

  // 1. Remove mídias das mensagens dessas conversas
  const media = await pool.query(`
    DELETE FROM whatsapp_media
    WHERE message_id IN (
      SELECT m.id FROM whatsapp_messages m
      JOIN whatsapp_conversations c ON c.id = m.conversation_id
      WHERE c.phone = 'status'
    )
  `);
  console.log(`✓ ${media.rowCount ?? 0} mídia(s) removida(s).`);

  // 2. Remove marcadores de leitura dessas conversas
  const reads = await pool.query(`
    DELETE FROM whatsapp_conversation_reads
    WHERE conversation_id IN (
      SELECT id FROM whatsapp_conversations WHERE phone = 'status'
    )
  `);
  console.log(`✓ ${reads.rowCount ?? 0} marcador(es) de leitura removido(s).`);

  // 3. Remove mensagens dessas conversas (reactions caem por onDelete: cascade)
  const messages = await pool.query(`
    DELETE FROM whatsapp_messages
    WHERE conversation_id IN (
      SELECT id FROM whatsapp_conversations WHERE phone = 'status'
    )
  `);
  console.log(`✓ ${messages.rowCount ?? 0} mensagem(ns) removida(s).`);

  // 4. Remove as conversas "status"
  const conversations = await pool.query(`
    DELETE FROM whatsapp_conversations WHERE phone = 'status'
  `);
  console.log(`✓ ${conversations.rowCount ?? 0} conversa(s) removida(s).`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na limpeza:", err);
  process.exit(1);
});
