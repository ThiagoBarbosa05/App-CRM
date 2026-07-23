/**
 * Cria as tabelas do chat interno da equipe (DM + grupos), desacoplado de
 * whatsapp_conversations (atendimento a cliente) e de grupos reais do
 * WhatsApp (que continuam sendo ignorados no Baileys):
 * - internal_conversations: uma conversa 1:1 (dm) ou em grupo (group)
 * - internal_conversation_members: vínculo usuário <-> conversa, com papel
 *   (owner/admin/member) relevante só para grupos
 * - internal_messages: mensagens de texto/sistema de uma conversa
 * - internal_message_media: anexo (imagem/arquivo) de uma mensagem
 * - internal_message_reads: marcador de última leitura por usuário/conversa
 *
 * Uso:
 *   node scripts/create-internal-chat-tables.mjs
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
  CREATE TABLE IF NOT EXISTS internal_conversations (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    type text NOT NULL,
    name text,
    avatar_url text,
    dm_key text UNIQUE,
    created_by_user_id varchar NOT NULL REFERENCES users(id),
    is_archived boolean NOT NULL DEFAULT false,
    last_message_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )
`;
console.log("[migration] Tabela internal_conversations criada (ou já existente).");

await sql`
  CREATE TABLE IF NOT EXISTS internal_conversation_members (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id varchar NOT NULL REFERENCES internal_conversations(id) ON DELETE CASCADE,
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member',
    joined_at timestamp NOT NULL DEFAULT now(),
    left_at timestamp,
    UNIQUE (conversation_id, user_id)
  )
`;
console.log("[migration] Tabela internal_conversation_members criada (ou já existente).");

await sql`
  CREATE INDEX IF NOT EXISTS internal_conversation_members_user_idx
  ON internal_conversation_members (user_id)
`;
await sql`
  CREATE INDEX IF NOT EXISTS internal_conversation_members_conversation_idx
  ON internal_conversation_members (conversation_id)
`;
console.log("[migration] Índices de internal_conversation_members criados (ou já existentes).");

await sql`
  CREATE TABLE IF NOT EXISTS internal_messages (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id varchar NOT NULL REFERENCES internal_conversations(id) ON DELETE CASCADE,
    sender_id varchar REFERENCES users(id) ON DELETE SET NULL,
    content text,
    type text NOT NULL DEFAULT 'text',
    reply_to_message_id varchar,
    edited_at timestamp,
    deleted_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  )
`;
console.log("[migration] Tabela internal_messages criada (ou já existente).");

await sql`
  CREATE INDEX IF NOT EXISTS internal_messages_conversation_created_idx
  ON internal_messages (conversation_id, created_at)
`;
console.log("[migration] Índice de internal_messages criado (ou já existente).");

await sql`
  CREATE TABLE IF NOT EXISTS internal_message_media (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id varchar NOT NULL REFERENCES internal_messages(id) ON DELETE CASCADE,
    url text NOT NULL,
    mime_type text NOT NULL,
    file_name text,
    size_bytes integer,
    created_at timestamp NOT NULL DEFAULT now()
  )
`;
console.log("[migration] Tabela internal_message_media criada (ou já existente).");

await sql`
  CREATE TABLE IF NOT EXISTS internal_message_reads (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id varchar NOT NULL REFERENCES internal_conversations(id) ON DELETE CASCADE,
    last_read_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (user_id, conversation_id)
  )
`;
console.log("[migration] Tabela internal_message_reads criada (ou já existente).");

console.log("[migration] Concluído.");
