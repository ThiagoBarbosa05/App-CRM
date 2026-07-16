/**
 * Fase 5 do PDV Restaurante: cardápio do dia + itens de comanda vinculados
 * ao catálogo geral de produtos (products) + snapshot da conta Bling ativa
 * na comanda.
 *
 * Uso:
 *   node scripts/create-restaurant-daily-menu-and-product-link.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

// 1. Cardápio do dia
await sql`
  CREATE TABLE IF NOT EXISTS restaurant_daily_menu_items (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    date text NOT NULL,
    menu_item_id varchar NOT NULL REFERENCES restaurant_menu_items(id),
    created_by varchar NOT NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now()
  )
`;
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS restaurant_daily_menu_items_date_item_uidx
  ON restaurant_daily_menu_items (date, menu_item_id)
`;
await sql`
  CREATE INDEX IF NOT EXISTS restaurant_daily_menu_items_date_idx
  ON restaurant_daily_menu_items (date)
`;
console.log(
  "[migration] Tabela restaurant_daily_menu_items criada (ou já existente).",
);

// 2. Item de comanda vinculado a produto do catálogo geral
await sql`
  ALTER TABLE restaurant_order_items
  ADD COLUMN IF NOT EXISTS product_id varchar REFERENCES products(id)
`;
await sql`
  CREATE INDEX IF NOT EXISTS restaurant_order_items_product_idx
  ON restaurant_order_items (product_id)
`;
console.log(
  "[migration] Coluna product_id adicionada em restaurant_order_items (ou já existente).",
);

const [{ exists: constraintExists }] = await sql`
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_order_items_source_check'
  ) AS exists
`;
if (!constraintExists) {
  await sql`
    ALTER TABLE restaurant_order_items
    ADD CONSTRAINT restaurant_order_items_source_check
    CHECK ((menu_item_id IS NOT NULL)::int + (product_id IS NOT NULL)::int <= 1)
  `;
  console.log(
    "[migration] Constraint restaurant_order_items_source_check criada.",
  );
} else {
  console.log(
    "[migration] Constraint restaurant_order_items_source_check já existe.",
  );
}

// 3. Snapshot da conta Bling ativa na abertura da comanda
await sql`
  ALTER TABLE restaurant_orders
  ADD COLUMN IF NOT EXISTS bling_connection_id varchar
`;
console.log(
  "[migration] Coluna bling_connection_id adicionada em restaurant_orders (ou já existente).",
);

console.log("[migration] Concluído.");
