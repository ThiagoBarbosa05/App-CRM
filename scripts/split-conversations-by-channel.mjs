/**
 * Divide conversas de WhatsApp que hoje misturam mensagens de vários canais
 * (logo, de vários atendentes/setores) numa única linha de whatsapp_conversations.
 *
 * Antes desta migração, findOrCreateConversation buscava a conversa só por
 * telefone, ignorando o canal — então todo atendente que falasse com o mesmo
 * contato reusava a mesma linha/thread. A correção passou a escopar a busca
 * por telefone + canal (cada canal pertence a um atendente). Este script
 * reconstrói o histórico existente para bater com essa nova regra: para cada
 * conversa, agrupa as mensagens por channel_id e cria uma nova linha de
 * conversa para cada canal além do primeiro, repontando as mensagens.
 *
 * Mensagens com channel_id nulo (ex.: mensagens de sistema/log de
 * transferência) permanecem na conversa original ("grupo mantido").
 *
 * Uso:  node scripts/split-conversations-by-channel.mjs
 */
import fs from "fs";
import { neon } from "@neondatabase/serverless";

const env = fs.readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");
const sql = neon(url);

const conversations = await sql`
  SELECT id, phone, client_id, contact_name, contact_photo_url, channel_id, sector_id,
         assigned_agent_id, status
  FROM whatsapp_conversations
  ORDER BY created_at ASC`;

let splitConversations = 0;
let createdRows = 0;
let movedMessages = 0;

for (const conv of conversations) {
  const messages = await sql`
    SELECT id, channel_id, COALESCE(sent_at, created_at) AS effective_at
    FROM whatsapp_messages
    WHERE conversation_id = ${conv.id}
    ORDER BY effective_at ASC`;

  if (messages.length === 0) continue;

  const groups = new Map(); // channelId (number | null) -> { messageIds, minAt, maxAt }
  for (const m of messages) {
    const key = m.channel_id ?? null;
    if (!groups.has(key)) groups.set(key, { messageIds: [], minAt: m.effective_at, maxAt: m.effective_at });
    const g = groups.get(key);
    g.messageIds.push(m.id);
    if (m.effective_at < g.minAt) g.minAt = m.effective_at;
    if (m.effective_at > g.maxAt) g.maxAt = m.effective_at;
  }

  const nonNullChannelKeys = [...groups.keys()].filter((k) => k !== null);
  if (nonNullChannelKeys.length <= 1) continue; // nada para dividir

  // Grupo mantido na linha original: o canal já gravado em whatsapp_conversations,
  // se ele aparecer entre as mensagens; senão, o primeiro canal cronologicamente.
  // Mensagens sem canal (sistema/log) ficam com o grupo mantido, junto com as
  // do próprio canal mantido — nenhuma delas precisa ser movida.
  const keptChannelId = groups.has(conv.channel_id) ? conv.channel_id : nonNullChannelKeys[0];

  console.log(
    `Conversa ${conv.id} (phone ${conv.phone}): ${nonNullChannelKeys.length} canais distintos — dividindo, mantendo canal ${keptChannelId}.`,
  );
  splitConversations++;

  for (const channelId of nonNullChannelKeys) {
    if (channelId === keptChannelId) continue;

    const group = groups.get(channelId);
    const [channel] = await sql`
      SELECT default_sector_id, user_id FROM whatsapp_channels WHERE id = ${channelId}`;

    const [newConv] = await sql`
      INSERT INTO whatsapp_conversations
        (phone, client_id, contact_name, contact_photo_url, channel_id, sector_id,
         assigned_agent_id, status, last_message_at, created_at, updated_at)
      VALUES
        (${conv.phone}, ${conv.client_id}, ${conv.contact_name}, ${conv.contact_photo_url},
         ${channelId}, ${channel?.default_sector_id ?? null}, ${channel?.user_id ?? null},
         ${conv.status}, ${group.maxAt}, ${group.minAt}, ${group.maxAt})
      RETURNING id`;
    createdRows++;

    const moved = await sql`
      UPDATE whatsapp_messages
      SET conversation_id = ${newConv.id}
      WHERE id = ANY(${group.messageIds})
      RETURNING id`;
    movedMessages += moved.length;

    console.log(`  → canal ${channelId}: nova conversa ${newConv.id}, ${moved.length} mensagem(ns) movida(s).`);
  }
}

console.log(
  `Concluído: ${splitConversations} conversa(s) dividida(s), ${createdRows} nova(s) conversa(s) criada(s), ${movedMessages} mensagem(ns) movida(s).`,
);
