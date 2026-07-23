/**
 * Repara whatsapp_conversations.contact_name corrompido pelo bug em que
 * mensagens outbound (_fromMe, vendedor respondendo direto pelo celular)
 * sobrescreviam contact_name com o pushName da PRÓPRIA conta conectada
 * (ex.: "Grand Cru Copacabana") em vez do nome do cliente. Corrigido em
 * saveInboundMessage (whatsapp-conversations.service.ts) para não repetir,
 * mas conversas já afetadas continuam com o nome errado até este reparo.
 *
 * Para cada conversa sem client_id vinculado, recalcula contact_name a partir
 * do pushName da mensagem INBOUND mais recente (raw_payload->>'pushName').
 * Se não houver nenhuma mensagem inbound com pushName, contact_name vira NULL
 * (a UI cai no fallback do telefone).
 *
 * Uso:  node scripts/repair-contact-name-from-outbound.mjs
 */
import fs from "fs";
import { neon } from "@neondatabase/serverless";

const env = fs.readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");
const sql = neon(url);

const conversations = await sql`
  SELECT id, phone, contact_name
  FROM whatsapp_conversations
  WHERE client_id IS NULL AND contact_name IS NOT NULL AND contact_name <> ''`;

let fixed = 0;
let cleared = 0;
let unchanged = 0;

for (const conv of conversations) {
  const [lastInbound] = await sql`
    SELECT raw_payload->>'pushName' AS push_name
    FROM whatsapp_messages
    WHERE conversation_id = ${conv.id}
      AND direction = 'inbound'
      AND raw_payload->>'pushName' IS NOT NULL
      AND raw_payload->>'pushName' <> ''
    ORDER BY sent_at DESC
    LIMIT 1`;

  const correctName = lastInbound?.push_name ?? null;

  if (correctName === conv.contact_name) {
    unchanged++;
    continue;
  }

  await sql`UPDATE whatsapp_conversations SET contact_name = ${correctName}, updated_at = now() WHERE id = ${conv.id}`;
  if (correctName) {
    fixed++;
    console.log(`  ~ conversa ${conv.id} (${conv.phone}): "${conv.contact_name}" -> "${correctName}"`);
  } else {
    cleared++;
    console.log(`  - conversa ${conv.id} (${conv.phone}): "${conv.contact_name}" -> NULL (sem inbound com pushName)`);
  }
}

console.log(
  `\nConcluído: ${fixed} corrigida(s), ${cleared} zerada(s) (sem inbound), ${unchanged} já corretas. Total analisado: ${conversations.length}.`,
);
