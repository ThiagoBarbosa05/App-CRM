import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Atualizando tabela contact_tags para suportar tags do Umbler...");

  await db.execute(sql`
    ALTER TABLE contact_tags
      ALTER COLUMN tag_id DROP NOT NULL
  `);
  console.log("✓ tag_id agora é nullable.");

  await db.execute(sql`
    ALTER TABLE contact_tags
      ADD COLUMN IF NOT EXISTS external_tag_id VARCHAR
        REFERENCES external_tags(id) ON DELETE CASCADE
  `);
  console.log("✓ Coluna external_tag_id adicionada.");

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS contact_tags_client_tag_unique
      ON contact_tags (client_id, tag_id)
      WHERE tag_id IS NOT NULL
  `);
  console.log("✓ Unique index (client_id, tag_id) criado.");

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS contact_tags_client_external_tag_unique
      ON contact_tags (client_id, external_tag_id)
      WHERE external_tag_id IS NOT NULL
  `);
  console.log("✓ Unique index (client_id, external_tag_id) criado.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
