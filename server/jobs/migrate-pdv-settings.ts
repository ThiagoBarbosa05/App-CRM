import { db } from "../db";
import { sql } from "drizzle-orm";

export async function migratePdvSettings() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS restaurant_pdv_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        company_name TEXT NOT NULL DEFAULT 'PDV Restaurante',
        company_cnpj TEXT,
        company_address TEXT,
        company_phone TEXT,
        company_footer_message TEXT,
        default_service_fee_percent DECIMAL(5,2) NOT NULL DEFAULT 10.00,
        waiter_commission_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      INSERT INTO restaurant_pdv_settings (id) VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log("[Migrate] Tabela restaurant_pdv_settings verificada/criada.");
  } catch (err) {
    console.error("[Migrate] Erro ao criar tabela restaurant_pdv_settings:", err);
  }
}
