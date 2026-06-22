import { db } from "../server/db";
import { sql } from "drizzle-orm";

/**
 * Migração Fase 2 dos chatbots:
 * - whatsapp_conversations.sector_id  → nó "Transferir para setor"
 * - whatsapp_conversations.status     → nó "Status esperando"
 * - whatsapp_bot_sessions.resume_at   → nós de espera (Aguardar intervalo/até)
 */
async function main() {
  console.log("Aplicando migração Fase 2 dos chatbots...");

  await db.execute(sql`
    ALTER TABLE whatsapp_conversations
    ADD COLUMN IF NOT EXISTS sector_id VARCHAR REFERENCES sectors(id)
  `);

  await db.execute(sql`
    ALTER TABLE whatsapp_conversations
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
  `);

  await db.execute(sql`
    ALTER TABLE whatsapp_bot_sessions
    ADD COLUMN IF NOT EXISTS resume_at TIMESTAMP
  `);

  console.log("✓ Migração Fase 2 aplicada (sector_id, status, resume_at).");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
