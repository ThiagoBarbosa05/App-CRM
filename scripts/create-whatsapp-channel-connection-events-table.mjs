/**
 * Cria a tabela whatsapp_channel_connection_events: histórico de conexão/
 * desconexão dos canais Baileys (QR Code), com o motivo (DisconnectReason)
 * traduzido para pt-BR, para o vendedor acompanhar a estabilidade do canal.
 *
 * Uso:
 *   node scripts/create-whatsapp-channel-connection-events-table.mjs
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
  CREATE TABLE IF NOT EXISTS whatsapp_channel_connection_events (
    id serial PRIMARY KEY,
    channel_id integer NOT NULL REFERENCES whatsapp_channels(id),
    event_type text NOT NULL,
    reason_code text,
    reason_label text,
    created_at timestamp NOT NULL DEFAULT now()
  )
`;
console.log("[migration] Tabela whatsapp_channel_connection_events criada (ou já existente).");

await sql`
  CREATE INDEX IF NOT EXISTS whatsapp_channel_connection_events_channel_id_created_at_idx
  ON whatsapp_channel_connection_events (channel_id, created_at DESC)
`;
console.log("[migration] Índice de consulta por canal criado (ou já existente).");
