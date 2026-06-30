/**
 * Remove conversas-fantasma criadas com o número de disparo do bot (Cloud API)
 * antes da correção do filtro de números próprios.
 *
 * O número 5522992322421 ("Dionisio Teste", provider cloud_api) é um canal da
 * empresa — nenhuma conversa de contato legítima deveria existir com ele. Este
 * script apaga essas conversas e seus registros dependentes.
 *
 * NÃO toca na conversa 5522996212581 (canal Evolution "Loja - Búzios"), usada
 * como conversa de teste real.
 *
 * Uso:  node scripts/delete-ghost-bot-conversations.mjs
 */
import fs from "fs";
import { neon } from "@neondatabase/serverless";

const env = fs.readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^["']|["']$/g, "");
const sql = neon(url);

// Número(s) de disparo (Cloud API) cujas conversas de contato são espúrias.
const GHOST_PHONE_DIGITS = ["5522992322421"];

const convs = await sql`
  SELECT id, phone, created_at
  FROM whatsapp_conversations
  WHERE regexp_replace(phone, '\\D', '', 'g') = ANY(${GHOST_PHONE_DIGITS})`;

if (convs.length === 0) {
  console.log("Nenhuma conversa-fantasma encontrada. Nada a fazer.");
  process.exit(0);
}

for (const c of convs) {
  const reads = await sql`DELETE FROM whatsapp_conversation_reads WHERE conversation_id = ${c.id} RETURNING conversation_id`;
  const msgs = await sql`DELETE FROM whatsapp_messages WHERE conversation_id = ${c.id} RETURNING id`;
  const del = await sql`DELETE FROM whatsapp_conversations WHERE id = ${c.id} RETURNING id`;
  console.log(
    `Removida conversa ${c.id} (phone ${c.phone}): ${msgs.length} mensagem(ns), ${reads.length} leitura(s).`,
  );
}

console.log("Concluído.");
