/**
 * Cria o estado operacional independente de cada lado de um diálogo interno
 * canal↔canal e garante a infraestrutura de leitura por perspectiva.
 *
 * Idempotente. Uso:
 *   node scripts/add-whatsapp-conversation-perspective-states.mjs
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import "dotenv/config";
import ws from "ws";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: url, max: 1 });
const execute = async (text) => (await pool.query(text)).rows;
const quoteIdentifier = (identifier) => `"${identifier.replaceAll('"', '""')}"`;

try {
await execute(`
  ALTER TABLE whatsapp_conversation_reads
  ADD COLUMN IF NOT EXISTS perspective_channel_id integer REFERENCES whatsapp_channels(id)
`);

await execute(`
  CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversation_reads_user_conv_unique
    ON whatsapp_conversation_reads (user_id, conversation_id)
    WHERE perspective_channel_id IS NULL
`);
await execute(`
  CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversation_reads_user_conv_side_unique
    ON whatsapp_conversation_reads (user_id, conversation_id, perspective_channel_id)
    WHERE perspective_channel_id IS NOT NULL
`);

const staleConstraints = await execute(`
  SELECT c.conname, pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'whatsapp_conversation_reads'
    AND c.contype = 'u'
`);
for (const constraint of staleConstraints) {
  const definition = constraint.def.replace(/\s+/g, " ").trim();
  if (definition !== "UNIQUE (user_id, conversation_id)") continue;
  await execute(
    `ALTER TABLE whatsapp_conversation_reads DROP CONSTRAINT ${quoteIdentifier(constraint.conname)}`,
  );
}

const staleIndexes = await execute(`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'whatsapp_conversation_reads'
    AND indexdef LIKE '%UNIQUE%'
    AND indexdef NOT LIKE '%WHERE%'
`);
for (const index of staleIndexes) {
  if (!/\(user_id, conversation_id\)\s*$/.test(index.indexdef)) continue;
  await execute(`DROP INDEX IF EXISTS ${quoteIdentifier(index.indexname)}`);
}

await execute(`
  CREATE TABLE IF NOT EXISTS whatsapp_conversation_perspective_states (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id varchar NOT NULL
      REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
    channel_id integer NOT NULL REFERENCES whatsapp_channels(id),
    status text NOT NULL DEFAULT 'open',
    closed_at timestamp,
    closed_by varchar REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT whatsapp_conversation_perspective_states_status_check
      CHECK (status IN ('open', 'closed'))
  )
`);
await execute(`
  CREATE UNIQUE INDEX IF NOT EXISTS wa_conversation_perspective_states_conv_channel_unique
    ON whatsapp_conversation_perspective_states (conversation_id, channel_id)
`);

await execute(`
  INSERT INTO whatsapp_conversation_perspective_states (
    conversation_id,
    channel_id,
    status,
    closed_at,
    created_at,
    updated_at
  )
  SELECT
    conversation.id,
    side.channel_id,
    CASE WHEN conversation.status = 'closed' THEN 'closed' ELSE 'open' END,
    CASE WHEN conversation.status = 'closed' THEN conversation.updated_at ELSE NULL END,
    now(),
    now()
  FROM whatsapp_conversations conversation
  CROSS JOIN LATERAL (
    VALUES (conversation.channel_id), (conversation.peer_channel_id)
  ) AS side(channel_id)
  WHERE conversation.channel_id IS NOT NULL
    AND conversation.peer_channel_id IS NOT NULL
    AND side.channel_id IS NOT NULL
  ON CONFLICT (conversation_id, channel_id) DO NOTHING
`);

await execute(`
  INSERT INTO whatsapp_conversation_reads (
    user_id,
    conversation_id,
    perspective_channel_id,
    last_read_at
  )
  SELECT read.user_id, read.conversation_id, side.channel_id, read.last_read_at
  FROM whatsapp_conversation_reads read
  JOIN whatsapp_conversations conversation ON conversation.id = read.conversation_id
  JOIN users user_row ON user_row.id = read.user_id
  CROSS JOIN LATERAL (
    VALUES (conversation.channel_id), (conversation.peer_channel_id)
  ) AS side(channel_id)
  WHERE read.perspective_channel_id IS NULL
    AND user_row.role IN ('admin', 'gerente')
    AND conversation.channel_id IS NOT NULL
    AND conversation.peer_channel_id IS NOT NULL
    AND side.channel_id IS NOT NULL
  ON CONFLICT DO NOTHING
`);

console.log("[migration] Estados e leituras por perspectiva garantidos.");
} finally {
  await pool.end();
}
