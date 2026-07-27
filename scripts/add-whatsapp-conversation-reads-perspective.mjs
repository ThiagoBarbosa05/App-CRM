/**
 * whatsapp_conversation_reads.perspective_channel_id: lado do diálogo interno
 * que a marcação de leitura cobre. NULL = conversa inteira (comportamento
 * atual, e o estado de todas as linhas existentes — sem backfill obrigatório
 * para correção; ver seed opcional no fim deste script).
 *
 * Troca o unique (user_id, conversation_id) por DOIS índices únicos parciais:
 * unique comum não deduplica NULL, então sem o índice parcial a linha
 * "conversa inteira" deixaria de ter chave e o ON CONFLICT do upsert pararia
 * de disparar. Idempotente.
 *
 * Uso:
 *   node scripts/add-whatsapp-conversation-reads-perspective.mjs
 *
 * IMPORTANTE: rodar ANTES de subir o markConversationRead novo — sem os
 * índices parciais, o ON CONFLICT ... WHERE não acha árbitro e todo POST
 * /conversations/:id/read lança "no unique or exclusion constraint matching
 * the ON CONFLICT specification".
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  ALTER TABLE whatsapp_conversation_reads
  ADD COLUMN IF NOT EXISTS perspective_channel_id integer REFERENCES whatsapp_channels(id)
`;
console.log("[migration] Coluna perspective_channel_id criada (ou já existente).");

// Criar ANTES de dropar o unique antigo: o índice parcial de NULL é implicado
// pela constraint atual, então nunca falha, e não há janela sem unicidade.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversation_reads_user_conv_unique
    ON whatsapp_conversation_reads (user_id, conversation_id)
    WHERE perspective_channel_id IS NULL
`;
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversation_reads_user_conv_side_unique
    ON whatsapp_conversation_reads (user_id, conversation_id, perspective_channel_id)
    WHERE perspective_channel_id IS NOT NULL
`;
console.log("[migration] Índices únicos parciais criados.");

// Procura pela FORMA, não pelo nome: o unique veio do Drizzle e o nome default
// já mudou de padrão entre versões. Só derruba o que é exatamente
// UNIQUE (user_id, conversation_id) sobre a tabela inteira.
const staleConstraints = await sql`
  SELECT c.conname, pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'whatsapp_conversation_reads'
    AND c.contype = 'u'
`;
for (const c of staleConstraints) {
  const def = c.def.replace(/\s+/g, " ").trim();
  if (def !== "UNIQUE (user_id, conversation_id)") {
    console.log(`  = mantendo ${c.conname} (${def})`);
    continue;
  }
  console.log(`  - removendo ${c.conname} (${def})`);
  await sql.query(`ALTER TABLE whatsapp_conversation_reads DROP CONSTRAINT "${c.conname}"`);
}

// Índice único "solto" (não-constraint) com a mesma forma, se existir.
const staleIndexes = await sql`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'whatsapp_conversation_reads'
    AND indexdef LIKE '%UNIQUE%'
    AND indexdef NOT LIKE '%WHERE%'
    AND indexname NOT IN (
      'whatsapp_conversation_reads_user_conv_unique',
      'whatsapp_conversation_reads_user_conv_side_unique'
    )
`;
for (const idx of staleIndexes) {
  if (!/\(user_id, conversation_id\)\s*$/.test(idx.indexdef)) continue;
  console.log(`  - removendo índice ${idx.indexname}`);
  await sql.query(`DROP INDEX IF EXISTS "${idx.indexname}"`);
}

// Seed opcional: sem isso, no primeiro load após o deploy, os DOIS lados de
// todo diálogo interno aparecem com o histórico inteiro como não-lido para
// admin/gerente (join novo não acha linha de lado ainda). Auto-corrige com um
// clique por lado, mas evita a "parede de badges" copiando a marcação de
// conversa inteira de cada supervisor para os dois lados. Re-executável
// (ON CONFLICT DO NOTHING).
await sql`
  INSERT INTO whatsapp_conversation_reads (user_id, conversation_id, perspective_channel_id, last_read_at)
  SELECT r.user_id, r.conversation_id, side.channel_id, r.last_read_at
  FROM whatsapp_conversation_reads r
  JOIN whatsapp_conversations c ON c.id = r.conversation_id
  JOIN users u ON u.id = r.user_id
  CROSS JOIN LATERAL (VALUES (c.channel_id), (c.peer_channel_id)) AS side(channel_id)
  WHERE r.perspective_channel_id IS NULL
    AND u.role IN ('admin', 'gerente')
    AND c.channel_id IS NOT NULL
    AND c.peer_channel_id IS NOT NULL
    AND side.channel_id IS NOT NULL
  ON CONFLICT DO NOTHING
`;
console.log("[migration] Seed de marcações por lado para admin/gerente concluído.");

console.log("[migration] Concluído.");
