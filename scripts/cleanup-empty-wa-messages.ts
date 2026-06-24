import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

async function main() {
  console.log("Removendo mensagens de texto vazias (protocolo/sync do Baileys)...");
  const { rowCount } = await pool.query(`
    DELETE FROM whatsapp_messages m
    WHERE m.type = 'text'
      AND (m.content IS NULL OR m.content = '')
      AND NOT EXISTS (SELECT 1 FROM whatsapp_media md WHERE md.message_id = m.id)
  `);
  console.log(`✓ ${rowCount ?? 0} mensagem(ns) vazia(s) removida(s).`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na limpeza:", err);
  process.exit(1);
});
