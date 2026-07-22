/**
 * Mescla conversas duplicadas causadas pelo regex de normalização de telefone
 * quebrado: regexp_replace(phone, '\D', '', 'g') não funciona neste Postgres
 * (Neon) — \d/\D não são reconhecidos como classe de caractere, só [0-9]/[^0-9]
 * funcionam. Isso fazia a comparação de telefone virar comparação de string
 * exata, então o mesmo número salvo em formatos diferentes ("(22) 98852-3633"
 * vs "+5522988523633") nunca batia, gerando conversas duplicadas para o mesmo
 * telefone + canal. Corrigido o regex nos services; este script limpa as
 * duplicatas já existentes no banco.
 *
 * Agrupa conversas por (dígitos normalizados do telefone, channel_id), mantém
 * a mais antiga de cada grupo e move mensagens das demais para ela, apagando
 * as linhas vazias.
 *
 * Uso:  node scripts/merge-duplicate-conversations.mjs
 */
import fs from "fs";
import { neon } from "@neondatabase/serverless";

const env = fs.readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");
const sql = neon(url);

function normDigits(phone) {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
}

const rows = await sql`
  SELECT id, phone, channel_id, client_id, created_at
  FROM whatsapp_conversations
  ORDER BY created_at ASC`;

const groups = new Map(); // "digits|channelId" -> rows[]
for (const r of rows) {
  const key = `${normDigits(r.phone)}|${r.channel_id ?? "null"}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

let mergedGroups = 0;
let deletedRows = 0;
let movedMessages = 0;

for (const [key, group] of groups) {
  if (group.length <= 1) continue;

  const [keep, ...dupes] = group; // já ordenado por created_at ASC
  console.log(`Grupo ${key}: mantendo ${keep.id} (${keep.phone}), mesclando ${dupes.length} duplicata(s).`);
  mergedGroups++;

  for (const dupe of dupes) {
    const moved = await sql`
      UPDATE whatsapp_messages SET conversation_id = ${keep.id} WHERE conversation_id = ${dupe.id} RETURNING id`;
    movedMessages += moved.length;

    // Preserva client_id se a conversa mantida ainda não tiver um vinculado.
    if (!keep.client_id && dupe.client_id) {
      await sql`UPDATE whatsapp_conversations SET client_id = ${dupe.client_id} WHERE id = ${keep.id}`;
      keep.client_id = dupe.client_id;
    }

    await sql`DELETE FROM whatsapp_conversation_reads WHERE conversation_id = ${dupe.id}`;
    await sql`DELETE FROM whatsapp_conversations WHERE id = ${dupe.id}`;
    deletedRows++;

    console.log(`  → ${dupe.id} (${dupe.phone}): ${moved.length} mensagem(ns) movida(s), linha removida.`);
  }

  // Telefone da conversa mantida vira o formato mais "puro" (mais dígitos, já
  // que o objetivo é reduzir variação futura) entre os candidatos do grupo.
  const bestPhone = group.map((r) => r.phone).sort((a, b) => b.replace(/\D/g, "").length - a.replace(/\D/g, "").length)[0];
  if (bestPhone !== keep.phone) {
    await sql`UPDATE whatsapp_conversations SET phone = ${bestPhone} WHERE id = ${keep.id}`;
  }
}

console.log(
  `\nConcluído: ${mergedGroups} grupo(s) mesclado(s), ${deletedRows} conversa(s) duplicada(s) removida(s), ${movedMessages} mensagem(ns) movida(s).`,
);
