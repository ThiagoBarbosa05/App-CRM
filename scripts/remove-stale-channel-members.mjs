/**
 * Remove concessões (whatsapp_channel_members) que apontam para canais
 * desativados/excluídos (is_active = false) — quando um canal é deletado, o
 * grant de acesso não é limpo junto, e listChannelIdsForUser passava a
 * oferecer esse canal morto como opção (causa da conversa órfã com o extinto
 * canal "Carlos" apagada em delete-orphan-conversations.mjs).
 *
 * Por padrão roda em modo DRY-RUN (só lista o que seria apagado).
 * Passe --apply para de fato apagar.
 *
 * Uso:
 *   node scripts/remove-stale-channel-members.mjs           # dry-run
 *   node scripts/remove-stale-channel-members.mjs --apply   # apaga de verdade
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const sql = neon(url);

const stale = await sql`
  SELECT cm.id, cm.channel_id, c.name AS channel_name, cm.user_id, u.name AS user_name
  FROM whatsapp_channel_members cm
  JOIN whatsapp_channels c ON c.id = cm.channel_id
  JOIN users u ON u.id = cm.user_id
  WHERE c.is_active = false
`;

if (stale.length === 0) {
  console.log("Nenhum grant órfão encontrado. Nada a fazer.");
  process.exit(0);
}

console.log(`Encontrados ${stale.length} grant(s) órfão(s):\n`);
for (const s of stale) {
  console.log(`  - ${s.user_name} -> canal "${s.channel_name}" (id ${s.channel_id})`);
}

if (!apply) {
  console.log(`\nDRY-RUN: nada foi apagado. Rode com --apply para remover.`);
  process.exit(0);
}

const removed = await sql`
  DELETE FROM whatsapp_channel_members
  WHERE channel_id IN (SELECT id FROM whatsapp_channels WHERE is_active = false)
  RETURNING id
`;
console.log(`\nRemovido(s) ${removed.length} grant(s).`);
