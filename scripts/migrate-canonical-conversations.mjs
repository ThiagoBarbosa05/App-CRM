/**
 * Migração do modelo de identidade das conversas de WhatsApp.
 *
 * 1. Cria as colunas `phone_normalized` e `peer_channel_id` em
 *    whatsapp_conversations.
 * 2. Faz o backfill de `phone_normalized` (forma canônica: só dígitos, com DDI
 *    55 e com o 9º dígito) e de `peer_channel_id` (canal nosso dono do número
 *    da conversa, quando existir).
 * 3. Funde os pares ESPELHADOS de diálogos internos canal↔canal numa única
 *    conversa canônica. Antes, um diálogo entre dois canais nossos gerava duas
 *    linhas e — como whatsapp_messages.wa_message_id é unique global — cada
 *    mensagem caía em apenas UMA delas, deixando os dois lados com metade do
 *    histórico. A linha canônica é a do canal de MENOR id; as mensagens da
 *    outra são movidas com a direção invertida (o outbound de um lado é o
 *    inbound do outro), exceto as internas (system/note).
 * 4. Funde duplicatas de (phone_normalized, channel_id) — conversas criadas em
 *    corrida ou com o telefone gravado em formatos diferentes.
 * 5. Cria o índice único parcial que impede novas duplicatas.
 *
 * Idempotente: pode ser rodado mais de uma vez.
 *
 * Uso (banco de produção):
 *   node scripts/migrate-canonical-conversations.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/migrate-canonical-conversations.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL ou TEST_DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

// ── Normalização de telefone ────────────────────────────────────────────────
// Reimplementa canonicalPhone/phoneVariants de server/lib/phone.ts (que por sua
// vez delega a normalizePhoneE164 de shared/phone.ts). Duplicado aqui de
// propósito: scripts .mjs rodam fora do build TS e não importam os aliases do
// projeto. Manter os três em sincronia se a regra mudar.
function normalizePhoneE164(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const number = digits.slice(2);
    if (/^[6-9]/.test(number)) digits = `${ddd}9${number}`;
  }
  if (digits.length !== 10 && digits.length !== 11) return null;
  return `+55${digits}`;
}

function canonicalPhone(phone) {
  if (!phone) return "";
  const e164 = normalizePhoneE164(phone);
  return e164 ? e164.slice(1) : String(phone).replace(/\D/g, "");
}

// ── 1. Colunas ──────────────────────────────────────────────────────────────

await sql`
  ALTER TABLE whatsapp_conversations
    ADD COLUMN IF NOT EXISTS phone_normalized text,
    ADD COLUMN IF NOT EXISTS peer_channel_id integer REFERENCES whatsapp_channels(id)
`;
console.log("[migration] Colunas phone_normalized e peer_channel_id garantidas.");

// ── 2. Backfill ─────────────────────────────────────────────────────────────

const channels = await sql`
  SELECT id, name, display_phone FROM whatsapp_channels WHERE deleted_at IS NULL
`;

/** canonicalPhone(display_phone) → canal, para achar o canal dono de um número. */
const channelByPhone = new Map();
for (const ch of channels) {
  const key = canonicalPhone(ch.display_phone);
  if (key) channelByPhone.set(key, ch);
}

const conversations = await sql`
  SELECT id, phone, channel_id, created_at FROM whatsapp_conversations
`;

let backfilled = 0;
for (const conv of conversations) {
  const normalized = canonicalPhone(conv.phone);
  const peer = channelByPhone.get(normalized) ?? null;
  const peerId = peer && peer.id !== conv.channel_id ? peer.id : null;
  await sql`
    UPDATE whatsapp_conversations
       SET phone_normalized = ${normalized}, peer_channel_id = ${peerId}
     WHERE id = ${conv.id}
       AND (phone_normalized IS DISTINCT FROM ${normalized}
            OR peer_channel_id IS DISTINCT FROM ${peerId})
  `;
  backfilled += 1;
}
console.log(`[migration] Backfill aplicado em ${backfilled} conversas.`);

// ── 3/4. Fusão ──────────────────────────────────────────────────────────────

/**
 * Move mensagens, mídias (via mensagens) e marcações de leitura de `fromId`
 * para `intoId` e apaga a conversa de origem. `flipDirection` inverte
 * inbound/outbound das mensagens reais (não das internas), usado quando a
 * conversa de origem era o espelho do outro canal.
 */
async function mergeConversation(fromId, intoId, flipDirection) {
  if (fromId === intoId) return;

  if (flipDirection) {
    await sql`
      UPDATE whatsapp_messages
         SET conversation_id = ${intoId},
             direction = CASE WHEN direction = 'inbound' THEN 'outbound' ELSE 'inbound' END
       WHERE conversation_id = ${fromId}
         AND type NOT IN ('system', 'note')
    `;
    await sql`
      UPDATE whatsapp_messages SET conversation_id = ${intoId}
       WHERE conversation_id = ${fromId}
    `;
  } else {
    await sql`
      UPDATE whatsapp_messages SET conversation_id = ${intoId}
       WHERE conversation_id = ${fromId}
    `;
  }

  // whatsapp_conversation_reads tem unique (user_id, conversation_id): move só
  // o que não colide e descarta o resto (a marcação mais recente prevalece).
  await sql`
    UPDATE whatsapp_conversation_reads r
       SET conversation_id = ${intoId}
     WHERE r.conversation_id = ${fromId}
       AND NOT EXISTS (
         SELECT 1 FROM whatsapp_conversation_reads r2
          WHERE r2.user_id = r.user_id AND r2.conversation_id = ${intoId}
       )
  `;
  await sql`DELETE FROM whatsapp_conversation_reads WHERE conversation_id = ${fromId}`;

  await sql`DELETE FROM whatsapp_conversations WHERE id = ${fromId}`;
}

// 3. Pares espelhados canal↔canal.
const internal = await sql`
  SELECT id, phone, phone_normalized, channel_id, peer_channel_id, client_id, created_at
    FROM whatsapp_conversations
   WHERE peer_channel_id IS NOT NULL AND channel_id IS NOT NULL
   ORDER BY created_at ASC
`;

/** chave do par não-ordenado {A,B} → linhas das duas pontas */
const pairs = new Map();
for (const conv of internal) {
  const [lo, hi] = [conv.channel_id, conv.peer_channel_id].sort((a, b) => a - b);
  const key = `${lo}:${hi}`;
  if (!pairs.has(key)) pairs.set(key, []);
  pairs.get(key).push(conv);
}

let mergedInternal = 0;
for (const [key, rows] of pairs) {
  const [lo, hi] = key.split(":").map(Number);
  // Canônica = a conversa cujo dono é o canal de menor id (mesma regra de
  // canonicalInternalPair no service). Se não existir, promove uma das linhas.
  let canonical = rows.find((r) => r.channel_id === lo);
  if (!canonical) {
    canonical = rows[0];
    const peerPhone = channels.find((c) => c.id === hi)?.display_phone ?? canonical.phone;
    await sql`
      UPDATE whatsapp_conversations
         SET channel_id = ${lo},
             peer_channel_id = ${hi},
             phone = ${peerPhone},
             phone_normalized = ${canonicalPhone(peerPhone)}
       WHERE id = ${canonical.id}
    `;
  }

  for (const row of rows) {
    if (row.id === canonical.id) continue;
    // A outra ponta é a do canal `hi`: o que lá era outbound é inbound aqui.
    await mergeConversation(row.id, canonical.id, row.channel_id === hi);
    mergedInternal += 1;
  }

  await sql`
    UPDATE whatsapp_conversations SET peer_channel_id = ${hi} WHERE id = ${canonical.id}
  `;
}
console.log(`[migration] ${mergedInternal} conversas espelhadas fundidas em ${pairs.size} diálogos internos.`);

// 4. Duplicatas comuns de (phone_normalized, channel_id).
const dupes = await sql`
  SELECT phone_normalized, channel_id, array_agg(id ORDER BY created_at ASC) AS ids
    FROM whatsapp_conversations
   WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
   GROUP BY phone_normalized, channel_id
  HAVING count(*) > 1
`;

let mergedDupes = 0;
for (const row of dupes) {
  const [keep, ...rest] = row.ids;
  for (const id of rest) {
    await mergeConversation(id, keep, false);
    mergedDupes += 1;
  }
}
console.log(`[migration] ${mergedDupes} conversas duplicadas fundidas.`);

// ── 5. Índice único ─────────────────────────────────────────────────────────
// Parcial: conversas sem phone_normalized (entrada não normalizável) ficam de
// fora em vez de bloquear a criação do índice. COALESCE no canal porque NULL
// nunca conflita com NULL em índice único — o "balde" sem canal (campanha/bot)
// precisa ser único também.

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_phone_channel_unique
    ON whatsapp_conversations (phone_normalized, COALESCE(channel_id, -1))
    WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
`;
console.log("[migration] Índice único (phone_normalized, channel_id) criado.");

console.log("[migration] Concluída.");
