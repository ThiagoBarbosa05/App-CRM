import { db } from "../db";
import { sql } from "drizzle-orm";

export async function migrateOrderClient() {
  try {
    await db.execute(sql`
      ALTER TABLE restaurant_orders
        ADD COLUMN IF NOT EXISTS client_id VARCHAR REFERENCES clients(id),
        ADD COLUMN IF NOT EXISTS client_name TEXT
    `);
    console.log("[Migrate] Colunas client_id / client_name em restaurant_orders verificadas/criadas.");
  } catch (err) {
    console.error("[Migrate] Erro ao adicionar client_id/client_name em restaurant_orders:", err);
  }
}
