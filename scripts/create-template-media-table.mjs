/**
 * Cria a tabela whatsapp_template_media, que guarda a mídia padrão de cabeçalho
 * (imagem/vídeo/documento) por template aprovado da Meta. Usada no envio de
 * templates com header de mídia pela tela de conversas.
 *
 * Uso:
 *   node scripts/create-template-media-table.mjs
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
  CREATE TABLE IF NOT EXISTS whatsapp_template_media (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name text NOT NULL,
    language_code text NOT NULL DEFAULT 'pt_BR',
    media_type text NOT NULL,
    storage_key text NOT NULL,
    created_by varchar REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_template_media_name_lang_unique
    ON whatsapp_template_media (template_name, language_code)
`;

console.log("[migration] Tabela whatsapp_template_media criada (ou já existente).");
