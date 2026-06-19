import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Criando tabela wa_quick_replies...");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wa_quick_replies (
      id         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, title)
    )
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS wa_quick_replies_user_id_idx
    ON wa_quick_replies(user_id)
  `);

  console.log("✓ Tabela wa_quick_replies criada.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro ao criar tabela:", err);
  process.exit(1);
});
