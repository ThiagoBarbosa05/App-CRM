import { db } from "../server/db";
import { sql } from "drizzle-orm";

/**
 * Migração: substitui a etiqueta do WhatsApp por um campo boolean explícito
 * para identificar clientes que não podem receber mensagens de marketing.
 */
async function main() {
  console.log("Atualizando tabela clients...");

  await db.execute(sql`
    ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS whatsapp_opt_out BOOLEAN NOT NULL DEFAULT false
  `);

  // Backfill: clientes que já tinham opt-out marcado via whatsapp_opt_out_at
  // (fluxo anterior, baseado em timestamp) recebem o boolean equivalente.
  await db.execute(sql`
    UPDATE clients
    SET whatsapp_opt_out = true
    WHERE whatsapp_opt_out_at IS NOT NULL
  `);

  console.log("✓ clients: coluna whatsapp_opt_out adicionada e populada a partir de whatsapp_opt_out_at.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
