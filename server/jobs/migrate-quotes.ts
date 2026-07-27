import { db } from "../db";
import { sql } from "drizzle-orm";

/**
 * Ensures the quotes_number_seq sequence and tables exist.
 * Safe to run on every startup (all statements are idempotent).
 */
export async function migrateQuotes() {
  try {
    await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS quotes_number_seq START 1`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quotes (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_number TEXT NOT NULL DEFAULT ('ORC-' || LPAD(nextval('quotes_number_seq')::TEXT, 4, '0')),
        client_id VARCHAR REFERENCES clients(id),
        client_name TEXT,
        client_phone TEXT,
        assigned_to_id VARCHAR REFERENCES users(id),
        status TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft','sent','accepted','rejected','converted','cancelled')),
        valid_until DATE,
        payment_conditions TEXT NOT NULL DEFAULT 'avista',
        notes TEXT,
        global_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
        global_discount_type TEXT NOT NULL DEFAULT 'percent'
          CHECK (global_discount_type IN ('percent','fixed')),
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
        total DECIMAL(12,2) NOT NULL DEFAULT 0,
        converted_sale_id VARCHAR,
        created_by_id VARCHAR REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS quote_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_id VARCHAR NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        product_id VARCHAR REFERENCES products(id),
        product_name TEXT NOT NULL,
        quantity DECIMAL(10,3) NOT NULL DEFAULT 1,
        unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        discount DECIMAL(12,2) NOT NULL DEFAULT 0,
        discount_type TEXT NOT NULL DEFAULT 'percent'
          CHECK (discount_type IN ('percent','fixed')),
        line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS quotes_client_id_idx ON quotes(client_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes(status)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS quotes_assigned_idx ON quotes(assigned_to_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON quote_items(quote_id)`);

    console.log("[Migrate] Tabelas quotes / quote_items verificadas/criadas.");
  } catch (err) {
    console.error("[Migrate] migrateQuotes falhou:", err);
  }
}
