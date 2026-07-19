/**
 * Adiciona whatsapp_channels.default_sector_id: setor para o qual conversas
 * novas recebidas por este canal são roteadas automaticamente
 * (findOrCreateConversation), evitando que um contato novo fique sem setor e,
 * por isso, invisível a todo vendedor sob a regra "setor E canal" de
 * vendorScopeCondition.
 *
 * Coluna nullable, sem backfill — conversas/canais existentes continuam sem
 * setor padrão até o admin configurar um; a triagem manual (filtro "Sem
 * setor") continua funcionando normalmente enquanto isso.
 *
 * Uso:
 *   node scripts/add-whatsapp-channel-default-sector.mjs
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
  ALTER TABLE whatsapp_channels
  ADD COLUMN IF NOT EXISTS default_sector_id varchar REFERENCES whatsapp_sectors(id)
`;
console.log("[migration] Coluna whatsapp_channels.default_sector_id criada (ou já existente).");

console.log("[migration] Concluído.");
