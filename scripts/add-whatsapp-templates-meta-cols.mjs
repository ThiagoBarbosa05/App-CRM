/**
 * Adiciona as colunas meta_template_id, meta_status e quality_score à tabela
 * whatsapp_templates. Essas colunas já existiam na definição do schema
 * Drizzle há tempo, mas a migração nunca havia sido aplicada ao banco real —
 * isso quebrava qualquer SELECT * em whatsapp_templates (usado por
 * ensureLocalTemplateForMeta ao criar uma campanha com template), retornando
 * "column meta_template_id does not exist".
 *
 * Uso (banco de produção):
 *   node scripts/add-whatsapp-templates-meta-cols.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-whatsapp-templates-meta-cols.mjs
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
  ALTER TABLE whatsapp_templates
    ADD COLUMN IF NOT EXISTS meta_template_id text,
    ADD COLUMN IF NOT EXISTS meta_status text,
    ADD COLUMN IF NOT EXISTS quality_score text
`;

const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'whatsapp_templates' AND column_name IN ('meta_template_id', 'meta_status', 'quality_score')
  ORDER BY column_name
`;
console.log("[migration] Colunas meta_* em whatsapp_templates:", cols.map((c) => c.column_name));
