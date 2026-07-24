/**
 * Desfaz o vínculo de cliente em conversas internas canal↔canal.
 *
 * Antes da correção em `findOrCreateConversation` (server/services/
 * whatsapp-conversations.service.ts), um diálogo entre dois canais nossos
 * podia acabar vinculado a um cliente cujo telefone coincidisse com o do
 * canal peer — o número de um canal nunca deveria virar "cliente", mas o
 * match por telefone não distinguia os dois casos. Isso fazia o título da
 * conversa mostrar o nome/cadastro do cliente em vez do nome do atendente do
 * outro lado, e exibia indevidamente o card de qualidade de cadastro, edição
 * de etiquetas de CRM etc.
 *
 * Este script zera `client_id` de toda `whatsapp_conversations` com
 * `peer_channel_id IS NOT NULL`. NÃO apaga o cliente em si — só desfaz o
 * vínculo com a conversa, já que o registro do cliente pode ter sido criado
 * à mão e não deve ser destruído.
 *
 * Por padrão roda em modo DRY-RUN (só mostra o que seria alterado).
 * Passe --apply para de fato aplicar.
 *
 * Uso:
 *   node scripts/unlink-internal-conversation-clients.mjs            # dry-run
 *   node scripts/unlink-internal-conversation-clients.mjs --apply    # aplica de verdade
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/unlink-internal-conversation-clients.mjs --apply
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL ou TEST_DATABASE_URL no .env");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const sql = neon(url);

const rows = await sql`
  SELECT c.id, c.phone, c.channel_id, c.peer_channel_id, c.client_id,
         cl.name AS client_name
    FROM whatsapp_conversations c
    JOIN clients cl ON cl.id = c.client_id
   WHERE c.peer_channel_id IS NOT NULL
     AND c.client_id IS NOT NULL
`;

if (rows.length === 0) {
  console.log("Nenhuma conversa interna com cliente vinculado. Nada a fazer.");
  process.exit(0);
}

console.log(`${rows.length} conversa(s) interna(s) com cliente vinculado indevidamente:`);
for (const row of rows) {
  console.log(
    `  - conversation ${row.id} | phone=${row.phone} | channel_id=${row.channel_id} peer_channel_id=${row.peer_channel_id} | client_id=${row.client_id} ("${row.client_name}")`,
  );
}

if (!apply) {
  console.log("\nDRY-RUN: nada foi alterado. Rode com --apply para desvincular.");
  console.log("(O cliente em si NÃO é apagado — só o vínculo com a conversa.)");
  process.exit(0);
}

const ids = rows.map((r) => r.id);
const updated = await sql`
  UPDATE whatsapp_conversations SET client_id = NULL, updated_at = now()
   WHERE id = ANY(${ids})
  RETURNING id
`;

console.log(`\n✓ ${updated.length} conversa(s) desvinculada(s) de cliente.`);
console.log("Os clientes em si continuam cadastrados normalmente.");
