/**
 * Apaga uma conversa específica pelo id, junto com mensagens, mídias e
 * marcações de leitura dependentes. Uso pontual (ex.: conversa criada por
 * engano por causa do bug de colisão de número em getOwnChannelPhones —
 * ver server/services/whatsapp-baileys-events.service.ts).
 *
 * Por padrão roda em modo DRY-RUN (só mostra o que seria apagado).
 * Passe --apply para de fato apagar.
 *
 * Uso:
 *   node scripts/delete-conversation-by-id.mjs <conversationId>           # dry-run
 *   node scripts/delete-conversation-by-id.mjs <conversationId> --apply   # apaga de verdade
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const conversationId = process.argv[2];
const apply = process.argv.includes("--apply");

if (!conversationId) {
  console.error("Uso: node scripts/delete-conversation-by-id.mjs <conversationId> [--apply]");
  process.exit(1);
}

const sql = neon(url);

const [conv] = await sql`
  SELECT id, phone, channel_id, sector_id, client_id, created_at
  FROM whatsapp_conversations
  WHERE id = ${conversationId}
`;

if (!conv) {
  console.log("Conversa não encontrada. Nada a fazer.");
  process.exit(0);
}

const msgs = await sql`SELECT id, direction, content, created_at FROM whatsapp_messages WHERE conversation_id = ${conversationId} ORDER BY created_at`;

console.log(`Conversa ${conv.id} | phone=${conv.phone} | channel_id=${conv.channel_id} | client_id=${conv.client_id}`);
console.log(`${msgs.length} mensagem(ns):`);
for (const m of msgs) {
  console.log(`  - [${m.direction}] ${m.content ?? "(sem texto)"} — ${m.created_at.toISOString()}`);
}

if (!apply) {
  console.log("\nDRY-RUN: nada foi apagado. Rode com --apply para apagar.");
  process.exit(0);
}

const msgIds = msgs.map((m) => m.id);
let mediaCount = 0;
if (msgIds.length > 0) {
  const media = await sql`DELETE FROM whatsapp_media WHERE message_id = ANY(${msgIds}) RETURNING id`;
  mediaCount = media.length;
}
const reads = await sql`DELETE FROM whatsapp_conversation_reads WHERE conversation_id = ${conversationId} RETURNING id`;
const deletedMsgs = await sql`DELETE FROM whatsapp_messages WHERE conversation_id = ${conversationId} RETURNING id`;
await sql`DELETE FROM whatsapp_conversations WHERE id = ${conversationId}`;

console.log(
  `\nRemovida conversa ${conv.id}: ${deletedMsgs.length} mensagem(ns), ${mediaCount} mídia(s), ${reads.length} leitura(s).`,
);
