/**
 * Apaga conversas de WhatsApp "órfãs" — sem canal (channel_id IS NULL) e/ou
 * sem setor (sector_id IS NULL) — junto com suas mensagens, mídias e
 * marcações de leitura. Essas conversas ficam sempre invisíveis a qualquer
 * vendedor (vendorScopeCondition exige setor E canal preenchidos, ou
 * assignedAgentId batendo), então acumular esse lixo só atrapalha.
 *
 * Contexto: bug em startConversationByClientId (getActiveChannelIdByUserId só
 * enxergava canal PRÓPRIO, não concedido via whatsapp_channel_members) fazia
 * "iniciar conversa" cair num canal null ou num canal sem defaultSectorId
 * configurado, gerando essas órfãs. O bug foi corrigido; este script limpa o
 * que já foi criado antes da correção — dados de teste, sem valor de
 * histórico real.
 *
 * Por padrão roda em modo DRY-RUN (só lista o que seria apagado).
 * Passe --apply para de fato apagar.
 *
 * Uso:
 *   node scripts/delete-orphan-conversations.mjs           # dry-run
 *   node scripts/delete-orphan-conversations.mjs --apply   # apaga de verdade
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

const orphans = await sql`
  SELECT id, phone, client_id, channel_id, sector_id, assigned_agent_id, created_at
  FROM whatsapp_conversations
  WHERE channel_id IS NULL OR sector_id IS NULL
  ORDER BY created_at DESC
`;

if (orphans.length === 0) {
  console.log("Nenhuma conversa órfã encontrada. Nada a fazer.");
  process.exit(0);
}

console.log(`Encontradas ${orphans.length} conversa(s) órfã(s):\n`);
for (const c of orphans) {
  console.log(
    `  - ${c.id} | phone=${c.phone} | channel_id=${c.channel_id} | sector_id=${c.sector_id} | assigned_agent_id=${c.assigned_agent_id} | criada em ${c.created_at.toISOString()}`,
  );
}

if (!apply) {
  console.log(
    `\nDRY-RUN: nada foi apagado. Rode com --apply para apagar essas ${orphans.length} conversa(s) e seus dados dependentes (mensagens, mídias, leituras).`,
  );
  process.exit(0);
}

console.log("\nApagando...\n");

for (const c of orphans) {
  const msgs = await sql`SELECT id FROM whatsapp_messages WHERE conversation_id = ${c.id}`;
  const msgIds = msgs.map((m) => m.id);

  let mediaCount = 0;
  if (msgIds.length > 0) {
    const media = await sql`DELETE FROM whatsapp_media WHERE message_id = ANY(${msgIds}) RETURNING id`;
    mediaCount = media.length;
  }

  const reads = await sql`DELETE FROM whatsapp_conversation_reads WHERE conversation_id = ${c.id} RETURNING id`;
  const deletedMsgs = await sql`DELETE FROM whatsapp_messages WHERE conversation_id = ${c.id} RETURNING id`;
  await sql`DELETE FROM whatsapp_conversations WHERE id = ${c.id}`;

  console.log(
    `Removida conversa ${c.id} (phone ${c.phone}): ${deletedMsgs.length} mensagem(ns), ${mediaCount} mídia(s), ${reads.length} leitura(s).`,
  );
}

console.log("\nConcluído.");
