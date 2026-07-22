/**
 * Apaga TODAS as conversas de WhatsApp (e dados dependentes) de um número de
 * telefone específico — usado para resetar um contato de teste e recomeçar do
 * zero. Casa por dígitos normalizados (com/sem DDI 55), então pega todas as
 * conversas do número independente do formato salvo (ex.: "(22) 98852-3633",
 * "+5522988523633").
 *
 * Apaga em cascata: whatsapp_reactions, whatsapp_media (via mensagens),
 * whatsapp_messages, whatsapp_conversation_reads, whatsapp_conversations, e
 * sessões de bot (whatsapp_bot_sessions) do mesmo telefone.
 *
 * Uso:  node scripts/delete-conversations-by-phone.mjs <telefone> [--yes]
 * Sem --yes, só lista o que seria apagado (dry-run).
 */
import fs from "fs";
import { neon } from "@neondatabase/serverless";

const env = fs.readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");
const sql = neon(url);

const phoneArg = process.argv[2];
const confirm = process.argv.includes("--yes");

if (!phoneArg) {
  console.error("Uso: node scripts/delete-conversations-by-phone.mjs <telefone> [--yes]");
  process.exit(1);
}

function normDigits(phone) {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
}

const target = normDigits(phoneArg);
if (target.length < 8) {
  console.error(`Telefone normalizado muito curto ("${target}") — confira o argumento.`);
  process.exit(1);
}

const convs = await sql`
  SELECT id, phone, channel_id, sector_id
  FROM whatsapp_conversations
  WHERE regexp_replace(phone, '[^0-9]', '', 'g') = ${target}
     OR regexp_replace(phone, '[^0-9]', '', 'g') = ${"55" + target}`;

if (convs.length === 0) {
  console.log(`Nenhuma conversa encontrada para o telefone ${phoneArg} (dígitos: ${target}).`);
  process.exit(0);
}

const sessions = await sql`
  SELECT id, bot_id, phone_number, status
  FROM whatsapp_bot_sessions
  WHERE regexp_replace(phone_number, '[^0-9]', '', 'g') = ${target}
     OR regexp_replace(phone_number, '[^0-9]', '', 'g') = ${"55" + target}`;

console.log(`Telefone: ${phoneArg} (dígitos normalizados: ${target})`);
console.log(`Conversas encontradas: ${convs.length}`);
for (const c of convs) console.log(`  - ${c.id} (phone="${c.phone}", channel_id=${c.channel_id})`);
console.log(`Sessões de bot encontradas: ${sessions.length}`);
for (const s of sessions) console.log(`  - ${s.id} (bot=${s.bot_id}, status=${s.status})`);

if (!confirm) {
  console.log("\nDry-run — nada foi apagado. Rode de novo com --yes para confirmar a exclusão.");
  process.exit(0);
}

let totalMsgs = 0;
let totalMedia = 0;
let totalReactions = 0;

for (const c of convs) {
  const msgIds = (await sql`SELECT id FROM whatsapp_messages WHERE conversation_id = ${c.id}`).map((m) => m.id);

  if (msgIds.length > 0) {
    const reactions = await sql`DELETE FROM whatsapp_reactions WHERE message_id = ANY(${msgIds}) RETURNING id`;
    totalReactions += reactions.length;
    const media = await sql`DELETE FROM whatsapp_media WHERE message_id = ANY(${msgIds}) RETURNING id`;
    totalMedia += media.length;
  }

  const msgs = await sql`DELETE FROM whatsapp_messages WHERE conversation_id = ${c.id} RETURNING id`;
  totalMsgs += msgs.length;

  await sql`DELETE FROM whatsapp_conversation_reads WHERE conversation_id = ${c.id}`;
  await sql`DELETE FROM whatsapp_conversations WHERE id = ${c.id}`;
  console.log(`Apagada conversa ${c.id}: ${msgs.length} mensagem(ns).`);
}

for (const s of sessions) {
  await sql`DELETE FROM whatsapp_bot_sessions WHERE id = ${s.id}`;
  console.log(`Apagada sessão de bot ${s.id}.`);
}

console.log(
  `\nConcluído: ${convs.length} conversa(s), ${totalMsgs} mensagem(ns), ${totalMedia} mídia(s), ${totalReactions} reação(ões), ${sessions.length} sessão(ões) de bot apagadas.`,
);
