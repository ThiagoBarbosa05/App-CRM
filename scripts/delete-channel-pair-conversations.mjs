/**
 * Apaga a(s) conversa(s) interna(s) (canal↔canal) entre dois canais nossos —
 * útil para resetar o teste manual de diálogo interno (fluxo de conversas de
 * WhatsApp, ver docs/bug-conversas.md) sem ficar remendando o histórico de
 * teste anterior. Apaga em cascata: whatsapp_media (via mensagens),
 * whatsapp_conversation_reads, whatsapp_messages (whatsapp_reactions cai
 * junto — onDelete: cascade em message_id) e whatsapp_conversations.
 *
 * Por padrão roda em modo DRY-RUN (só mostra o que seria apagado).
 * Passe --apply para de fato apagar.
 *
 * Casa a conversa por `peer_channel_id` (identidade canônica que o código
 * atual preenche) E, como rede de segurança, por telefone (últimos 8 dígitos,
 * cobre com/sem DDI e com/sem o 9º dígito) — cobre qualquer linha antiga que
 * ainda não tenha `peer_channel_id` preenchido.
 *
 * Uso:
 *   node scripts/delete-channel-pair-conversations.mjs "Eventos" "Estoque - Búzios"            # dry-run
 *   node scripts/delete-channel-pair-conversations.mjs "Eventos" "Estoque - Búzios" --apply     # apaga de verdade
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/delete-channel-pair-conversations.mjs "Eventos" "Búzios" --apply
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL ou TEST_DATABASE_URL no .env");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const [nameA, nameB] = process.argv.slice(2).filter((a) => a !== "--apply");

if (!nameA || !nameB) {
  console.error(
    'Uso: node scripts/delete-channel-pair-conversations.mjs "<nome do canal A>" "<nome do canal B>" [--apply]',
  );
  process.exit(1);
}

const sql = neon(url);

async function findChannel(namePattern) {
  const rows = await sql`
    SELECT id, name, display_phone FROM whatsapp_channels
    WHERE name ILIKE ${`%${namePattern}%`} AND deleted_at IS NULL
  `;
  if (rows.length === 0) {
    console.error(`Nenhum canal encontrado para "${namePattern}"`);
    process.exit(1);
  }
  if (rows.length > 1) {
    console.error(
      `Mais de um canal bate com "${namePattern}": ${rows.map((r) => r.name).join(", ")}. Seja mais específico.`,
    );
    process.exit(1);
  }
  return rows[0];
}

const channelA = await findChannel(nameA);
const channelB = await findChannel(nameB);

console.log(`Canal A: "${channelA.name}" (id ${channelA.id}, ${channelA.display_phone ?? "sem telefone"})`);
console.log(`Canal B: "${channelB.name}" (id ${channelB.id}, ${channelB.display_phone ?? "sem telefone"})`);

// Match primário: peer_channel_id. Complementado por um match de telefone
// (últimos 8 dígitos) só quando os DOIS canais têm display_phone cadastrado —
// sem essa guarda, `right('', 8) = ''` bateria em qualquer telefone vazio e
// apagaria conversas demais.
const canPhoneMatch = !!channelA.display_phone && !!channelB.display_phone;

const byPeerId = await sql`
  SELECT id, phone, channel_id, peer_channel_id, contact_name, created_at
    FROM whatsapp_conversations
   WHERE (channel_id = ${channelA.id} AND peer_channel_id = ${channelB.id})
      OR (channel_id = ${channelB.id} AND peer_channel_id = ${channelA.id})
`;

const byPhone = canPhoneMatch
  ? await sql`
      SELECT id, phone, channel_id, peer_channel_id, contact_name, created_at
        FROM whatsapp_conversations
       WHERE (channel_id = ${channelA.id}
              AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 8) = right(regexp_replace(${channelB.display_phone}, '[^0-9]', '', 'g'), 8))
          OR (channel_id = ${channelB.id}
              AND right(regexp_replace(phone, '[^0-9]', '', 'g'), 8) = right(regexp_replace(${channelA.display_phone}, '[^0-9]', '', 'g'), 8))
    `
  : [];

const conversations = [...new Map([...byPeerId, ...byPhone].map((c) => [c.id, c])).values()];

if (conversations.length === 0) {
  console.log("\nNenhuma conversa interna encontrada entre esses dois canais. Nada a fazer.");
  process.exit(0);
}

console.log(`\n${conversations.length} conversa(s) encontrada(s):`);
for (const conv of conversations) {
  const msgs = await sql`
    SELECT id, direction, content, created_at FROM whatsapp_messages
     WHERE conversation_id = ${conv.id} ORDER BY created_at
  `;
  console.log(
    `  - ${conv.id} | phone=${conv.phone} | channel_id=${conv.channel_id} peer_channel_id=${conv.peer_channel_id ?? "-"} | contact_name=${conv.contact_name ?? "-"} | criada em ${conv.created_at.toISOString()}`,
  );
  for (const m of msgs) {
    console.log(`      [${m.direction}] ${m.content ?? "(sem texto)"} — ${m.created_at.toISOString()}`);
  }
}

if (!apply) {
  console.log("\nDRY-RUN: nada foi apagado. Rode com --apply para apagar.");
  process.exit(0);
}

const ids = conversations.map((c) => c.id);

const msgIds = (
  await sql`SELECT id FROM whatsapp_messages WHERE conversation_id = ANY(${ids})`
).map((m) => m.id);

let mediaCount = 0;
if (msgIds.length > 0) {
  const media = await sql`DELETE FROM whatsapp_media WHERE message_id = ANY(${msgIds}) RETURNING id`;
  mediaCount = media.length;
}
const reads = await sql`DELETE FROM whatsapp_conversation_reads WHERE conversation_id = ANY(${ids}) RETURNING id`;
const deletedMsgs = await sql`DELETE FROM whatsapp_messages WHERE conversation_id = ANY(${ids}) RETURNING id`;
const deletedConvs = await sql`DELETE FROM whatsapp_conversations WHERE id = ANY(${ids}) RETURNING id`;

console.log(
  `\nRemovida(s) ${deletedConvs.length} conversa(s): ${deletedMsgs.length} mensagem(ns), ${mediaCount} mídia(s), ${reads.length} leitura(s).`,
);
console.log("Pode testar do zero.");
