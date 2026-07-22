/**
 * Repara conversas em que mensagens de canais diferentes acabaram na mesma
 * conversa (poluição dos bugs: regex de telefone quebrado + channelId mutável +
 * a mesclagem manual anterior). No modelo correto, cada conversa é
 * (telefone + canal) e só contém mensagens daquele canal.
 *
 * Estratégia: cada whatsapp_messages já carrega seu próprio channel_id (por onde
 * realmente saiu/chegou). Para cada mensagem com channel_id não nulo, garante que
 * ela está na conversa que casa (telefone normalizado, message.channel_id),
 * criando essa conversa se ainda não existir. Mensagens de canal nulo
 * (sistema/log de transferência) ficam onde estão. Ao final, recalcula
 * conversations.channel_id para bater com as mensagens e remove conversas vazias.
 *
 * Uso:  node scripts/repair-conversation-channels.mjs
 */
import fs from "fs";
import { neon } from "@neondatabase/serverless";

const env = fs.readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");
const sql = neon(url);

function normDigits(phone) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
}

const channels = await sql`SELECT id, default_sector_id, user_id FROM whatsapp_channels`;
const channelById = new Map(channels.map((c) => [c.id, c]));

const conversations = await sql`
  SELECT id, phone, client_id, contact_name, contact_photo_url, channel_id,
         sector_id, assigned_agent_id, status, created_at
  FROM whatsapp_conversations
  ORDER BY created_at ASC`;

// Índice (telefone normalizado | canal) -> conversa (mais antiga vence).
const convByKey = new Map();
for (const c of conversations) {
  const key = `${normDigits(c.phone)}|${c.channel_id ?? "null"}`;
  if (!convByKey.has(key)) convByKey.set(key, c);
}

let createdConvs = 0;
let movedMessages = 0;

for (const src of conversations) {
  // Canais distintos (não nulos) presentes nas mensagens desta conversa.
  const rows = await sql`
    SELECT DISTINCT channel_id FROM whatsapp_messages
    WHERE conversation_id = ${src.id} AND channel_id IS NOT NULL`;
  const msgChannels = rows.map((r) => r.channel_id);
  if (msgChannels.length <= 1) continue; // já homogênea (ou só canal nulo)

  const srcDigits = normDigits(src.phone);
  for (const ch of msgChannels) {
    const key = `${srcDigits}|${ch}`;
    let target = convByKey.get(key);

    if (!target) {
      const chInfo = channelById.get(ch);
      const [created] = await sql`
        INSERT INTO whatsapp_conversations
          (phone, client_id, contact_name, contact_photo_url, channel_id, sector_id,
           assigned_agent_id, status, last_message_at, created_at, updated_at)
        VALUES
          (${src.phone}, ${src.client_id}, ${src.contact_name}, ${src.contact_photo_url},
           ${ch}, ${chInfo?.default_sector_id ?? null}, ${chInfo?.user_id ?? null},
           ${src.status}, now(), now(), now())
        RETURNING id, phone, channel_id, client_id`;
      target = created;
      convByKey.set(key, created);
      createdConvs++;
      console.log(`  + nova conversa ${created.id} para (${src.phone}, canal ${ch}).`);
    }

    if (target.id === src.id) continue; // canal já pertence a esta conversa

    const moved = await sql`
      UPDATE whatsapp_messages SET conversation_id = ${target.id}
      WHERE conversation_id = ${src.id} AND channel_id = ${ch}
      RETURNING id`;
    movedMessages += moved.length;
    console.log(`  → conversa ${src.id}: ${moved.length} msg(s) do canal ${ch} → ${target.id}.`);
  }
}

// Recalcula channel_id de cada conversa a partir das mensagens (canal único) e
// remove conversas que ficaram sem nenhuma mensagem.
let fixedChannel = 0;
let deletedEmpty = 0;
const after = await sql`SELECT id, channel_id FROM whatsapp_conversations`;
for (const c of after) {
  const chRows = await sql`
    SELECT DISTINCT channel_id FROM whatsapp_messages
    WHERE conversation_id = ${c.id} AND channel_id IS NOT NULL`;
  const total = await sql`SELECT count(*)::int AS n FROM whatsapp_messages WHERE conversation_id = ${c.id}`;

  if (total[0].n === 0) {
    await sql`DELETE FROM whatsapp_conversation_reads WHERE conversation_id = ${c.id}`;
    await sql`DELETE FROM whatsapp_conversations WHERE id = ${c.id}`;
    deletedEmpty++;
    console.log(`  - conversa vazia removida: ${c.id}.`);
    continue;
  }

  if (chRows.length === 1 && chRows[0].channel_id !== c.channel_id) {
    await sql`UPDATE whatsapp_conversations SET channel_id = ${chRows[0].channel_id} WHERE id = ${c.id}`;
    fixedChannel++;
    console.log(`  ~ conversa ${c.id}: channel_id ${c.channel_id} → ${chRows[0].channel_id}.`);
  }
}

console.log(
  `\nConcluído: ${createdConvs} conversa(s) criada(s), ${movedMessages} mensagem(ns) movida(s), ${fixedChannel} channel_id corrigido(s), ${deletedEmpty} conversa(s) vazia(s) removida(s).`,
);
