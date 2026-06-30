/**
 * Cria a tabela media_library, biblioteca de mídia compartilhada da equipe:
 * arquivos (imagem/vídeo/documento) que o usuário sobe uma vez e reutiliza —
 * ex.: cabeçalho de mídia de templates do WhatsApp na tela de conversas.
 *
 * Uso:
 *   node scripts/create-media-library-table.mjs
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
  CREATE TABLE IF NOT EXISTS media_library (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    storage_key text NOT NULL,
    media_type text NOT NULL,
    mime_type text NOT NULL,
    size integer NOT NULL DEFAULT 0,
    created_by varchar REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now()
  )
`;

console.log("[migration] Tabela media_library criada (ou já existente).");
