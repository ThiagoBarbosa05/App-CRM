/**
 * Cria as tabelas zernio_conversations e zernio_messages, que substituem o
 * armazenamento em memória do Inbox Unificado (server/lib/zernio-store.ts)
 * por persistência real. Os ids são os mesmos ids usados pelo Zernio
 * (conversationId / message.id vindos do webhook), não gerados localmente.
 *
 * Uso:
 *   node scripts/create-zernio-tables.mjs
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
  CREATE TABLE IF NOT EXISTS zernio_conversations (
    id varchar PRIMARY KEY,
    platform text NOT NULL,
    account_id text NOT NULL DEFAULT '',
    participant_id text,
    participant_name text,
    participant_username text,
    last_message_text text,
    last_message_at timestamp,
    last_message_direction text,
    unread_count integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS zernio_messages (
    id varchar PRIMARY KEY,
    conversation_id varchar NOT NULL REFERENCES zernio_conversations(id) ON DELETE CASCADE,
    direction text NOT NULL,
    text text,
    sender_id text,
    sender_name text,
    sent_at timestamp NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS zernio_messages_conversation_idx
  ON zernio_messages (conversation_id)
`;

console.log("[migration] Tabelas zernio_conversations e zernio_messages criadas (ou já existentes).");
