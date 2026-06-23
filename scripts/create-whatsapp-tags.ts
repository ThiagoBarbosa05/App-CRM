import { db } from "../server/db";
import { sql } from "drizzle-orm";

/**
 * Cria a tabela whatsapp_tags (tags do Umbler com todos os dados),
 * adiciona contact_tags.whatsapp_tag_id como nova chave pivô,
 * faz backfill a partir das tabelas legadas external_tags/contact_tags,
 * e remove de vez external_tags e client_tags.
 *
 * Idempotente — pode ser rodado mais de uma vez com segurança.
 * Uso: tsx scripts/create-whatsapp-tags.ts
 */
async function main() {
  console.log("Criando estrutura de whatsapp_tags...");

  // 1. Tabela whatsapp_tags
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS whatsapp_tags (
      id              VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      umbler_tag_id   VARCHAR NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      emoji           TEXT,
      color           TEXT,
      description     TEXT,
      "order"         INTEGER,
      group_ids       TEXT[] DEFAULT '{}',
      umbler_created_at TIMESTAMP,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log("✓ Tabela whatsapp_tags criada.");

  // 2. Nova coluna pivô em contact_tags
  await db.execute(sql`
    ALTER TABLE contact_tags
      ADD COLUMN IF NOT EXISTS whatsapp_tag_id VARCHAR
        REFERENCES whatsapp_tags(id) ON DELETE CASCADE
  `);
  console.log("✓ Coluna contact_tags.whatsapp_tag_id adicionada.");

  // 3. Backfill: migrar external_tags -> whatsapp_tags (se a tabela legada existir)
  const hasExternalTags = await db.execute(sql`
    SELECT to_regclass('public.external_tags') AS reg
  `);
  const externalTagsExists = (hasExternalTags.rows?.[0] as { reg: string | null } | undefined)?.reg;

  if (externalTagsExists) {
    // Cada external_tag vira uma whatsapp_tag (external_id = umbler_tag_id)
    await db.execute(sql`
      INSERT INTO whatsapp_tags (umbler_tag_id, name)
      SELECT et.external_id, COALESCE(et.external_tag_name, et.external_id)
      FROM external_tags et
      WHERE et.external_id IS NOT NULL
      ON CONFLICT (umbler_tag_id) DO NOTHING
    `);
    console.log("✓ Backfill external_tags -> whatsapp_tags concluído.");

    // Popular contact_tags.whatsapp_tag_id a partir do external_tag_id atual
    const hasExternalCol = await db.execute(sql`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'contact_tags' AND column_name = 'external_tag_id'
    `);
    if ((hasExternalCol.rows?.length ?? 0) > 0) {
      await db.execute(sql`
        UPDATE contact_tags ct
        SET whatsapp_tag_id = wt.id
        FROM external_tags et
        JOIN whatsapp_tags wt ON wt.umbler_tag_id = et.external_id
        WHERE ct.external_tag_id = et.id
          AND ct.whatsapp_tag_id IS NULL
      `);
      console.log("✓ Backfill contact_tags.whatsapp_tag_id concluído.");
    }
  } else {
    console.log("• external_tags não existe — pulando backfill.");
  }

  // 4. Novo índice único e remoção do antigo
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS contact_tags_client_whatsapp_tag_unique
      ON contact_tags (client_id, whatsapp_tag_id)
      WHERE whatsapp_tag_id IS NOT NULL
  `);
  console.log("✓ Unique index (client_id, whatsapp_tag_id) criado.");

  await db.execute(sql`DROP INDEX IF EXISTS contact_tags_client_external_tag_unique`);

  // 5. Remover coluna e tabelas legadas
  await db.execute(sql`ALTER TABLE contact_tags DROP COLUMN IF EXISTS external_tag_id`);
  console.log("✓ Coluna contact_tags.external_tag_id removida.");

  await db.execute(sql`DROP TABLE IF EXISTS client_tags`);
  await db.execute(sql`DROP TABLE IF EXISTS external_tags`);
  console.log("✓ Tabelas client_tags e external_tags removidas.");

  console.log("Migração concluída com sucesso.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
