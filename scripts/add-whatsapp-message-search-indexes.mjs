/** Infraestrutura idempotente para busca textual e paginação do histórico. */
import { Pool, neonConfig } from "@neondatabase/serverless";
import "dotenv/config";
import ws from "ws";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: url, max: 1 });

try {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  await pool.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS whatsapp_messages_conversation_effective_at_idx
      ON whatsapp_messages (conversation_id, COALESCE(sent_at, created_at), id)
  `);
  await pool.query(`
    CREATE INDEX CONCURRENTLY IF NOT EXISTS whatsapp_messages_search_trgm_idx
      ON whatsapp_messages
      USING gin ((COALESCE(content, '') || ' ' || COALESCE(caption, '')) gin_trgm_ops)
  `);
  console.log("[migration] Índices de busca de mensagens garantidos.");
} finally {
  await pool.end();
}
