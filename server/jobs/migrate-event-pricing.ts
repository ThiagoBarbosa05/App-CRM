import { sql } from "drizzle-orm";
import { db } from "../db";

export async function migrateEventPricing() {
  await db.execute(
    sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS pricing_type text NOT NULL DEFAULT 'per_person'`,
  );
  await db.execute(
    sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS event_value numeric(10, 2) NOT NULL DEFAULT 0`,
  );
  await db.execute(
    sql`UPDATE events
        SET event_value = price_per_person
        WHERE pricing_type = 'per_person'
          AND event_value = 0
          AND price_per_person <> 0`,
  );
  console.log("[Migrate] Modelo de valor dos eventos verificado/atualizado.");
}