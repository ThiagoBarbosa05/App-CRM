import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

async function main() {
  console.log("Adicionando coluna channel_id em whatsapp_messages...");
  await pool.query(`
    ALTER TABLE whatsapp_messages
    ADD COLUMN IF NOT EXISTS channel_id integer REFERENCES whatsapp_channels(id)
  `);

  console.log("Backfill: copiando channel_id da conversa para as mensagens...");
  const { rowCount } = await pool.query(`
    UPDATE whatsapp_messages m
    SET channel_id = c.channel_id
    FROM whatsapp_conversations c
    WHERE m.conversation_id = c.id
      AND m.channel_id IS NULL
      AND c.channel_id IS NOT NULL
  `);
  console.log(`✓ ${rowCount ?? 0} mensagens atualizadas.`);

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
