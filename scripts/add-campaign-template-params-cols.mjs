/**
 * Adiciona colunas de variáveis/mídia de template (por campanha) à tabela
 * campaigns, usadas para personalizar o corpo/cabeçalho de templates Meta
 * enviados por campanhas de WhatsApp.
 *
 * Uso (banco de produção):
 *   node scripts/add-campaign-template-params-cols.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-campaign-template-params-cols.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL ou TEST_DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS meta_template_body_params jsonb,
    ADD COLUMN IF NOT EXISTS meta_template_header_params jsonb,
    ADD COLUMN IF NOT EXISTS meta_template_header_media_storage_key text,
    ADD COLUMN IF NOT EXISTS meta_template_header_media_type text
`;

const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'campaigns' AND column_name LIKE 'meta_template%'
  ORDER BY column_name
`;
console.log("[migration] Colunas meta_template* em campaigns:", cols.map((c) => c.column_name));
