import { db } from "../server/db";
import { sql } from "drizzle-orm";

/**
 * Migração: bots passam a ser iniciados manualmente ou por campanha.
 * - Adiciona a coluna `description`.
 * - Remove o NOT NULL de `trigger_type` (campo de gatilho legado, deprecado).
 */
async function main() {
  console.log("Atualizando tabela whatsapp_bots...");

  await db.execute(sql`
    ALTER TABLE whatsapp_bots
    ADD COLUMN IF NOT EXISTS description TEXT
  `);

  await db.execute(sql`
    ALTER TABLE whatsapp_bots
    ALTER COLUMN trigger_type DROP NOT NULL
  `);

  console.log("✓ whatsapp_bots: coluna description adicionada e trigger_type agora é opcional.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
