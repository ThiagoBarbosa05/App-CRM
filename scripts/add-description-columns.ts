import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  await db.execute(sql`ALTER TABLE note_sections ADD COLUMN IF NOT EXISTS description text`);
  await db.execute(sql`ALTER TABLE task_file_folders ADD COLUMN IF NOT EXISTS description text`);
  console.log("OK — colunas description adicionadas");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
