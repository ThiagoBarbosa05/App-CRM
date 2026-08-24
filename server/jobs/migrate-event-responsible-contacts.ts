import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * Cria a relação de responsáveis de eventos sem depender de db:push.
 * Pode ser executada várias vezes com segurança, inclusive no startup.
 */
export async function migrateEventResponsibleContacts() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS event_responsible_contacts (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id varchar NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      client_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT event_responsible_contacts_event_client_unique
        UNIQUE (event_id, client_id)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS event_responsible_contacts_client_id_idx
      ON event_responsible_contacts (client_id)
  `);
  console.log("[Migrate] Responsáveis de eventos verificados/atualizados.");
}