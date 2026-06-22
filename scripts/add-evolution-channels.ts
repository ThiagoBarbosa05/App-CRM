import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adicionando colunas de suporte Evolution API em whatsapp_channels...");

  await db.execute(sql`
    ALTER TABLE whatsapp_channels
      ALTER COLUMN phone_number_id DROP NOT NULL,
      ALTER COLUMN access_token    DROP NOT NULL,
      ALTER COLUMN waba_id         DROP NOT NULL
  `);
  console.log("✓ Colunas Meta tornadas nullable.");

  await db.execute(sql`
    ALTER TABLE whatsapp_channels
      ADD COLUMN IF NOT EXISTS provider                TEXT NOT NULL DEFAULT 'cloud_api',
      ADD COLUMN IF NOT EXISTS evolution_instance_name TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS connection_status       TEXT DEFAULT 'disconnected'
  `);
  console.log("✓ Colunas Evolution adicionadas.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
