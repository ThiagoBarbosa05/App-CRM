import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Criando tabela wa_saved_stickers...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wa_saved_stickers (
      id        VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id   VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_id  VARCHAR NOT NULL REFERENCES whatsapp_media(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, media_id)
    )
  `);

  console.log("✓ Tabela wa_saved_stickers criada.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro ao criar tabela:", err);
  process.exit(1);
});
