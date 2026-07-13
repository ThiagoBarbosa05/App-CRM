import { db } from "../server/db";
import { sql } from "drizzle-orm";

/**
 * Migração: opt-out de mensagens de marketing por WhatsApp.
 * - Adiciona `whatsapp_opt_out_at` (timestamp, null = recebe normalmente).
 * - Adiciona `whatsapp_opt_out_source` (keyword | manual), para auditoria.
 */
async function main() {
  console.log("Atualizando tabela clients...");

  await db.execute(sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS whatsapp_opt_out_at TIMESTAMP
  `);

  await db.execute(sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS whatsapp_opt_out_source TEXT
  `);

  console.log("✓ clients: colunas whatsapp_opt_out_at e whatsapp_opt_out_source adicionadas.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
