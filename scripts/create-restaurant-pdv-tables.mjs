/**
 * Cria as tabelas do PDV Restaurante: cardápio (restaurant_menu_items),
 * comandas (restaurant_orders) e itens de comanda (restaurant_order_items).
 *
 * Uso:
 *   node scripts/create-restaurant-pdv-tables.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS restaurant_menu_items (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    price decimal(10, 2) NOT NULL,
    category text,
    is_active boolean NOT NULL DEFAULT true,
    created_by varchar NOT NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS restaurant_orders (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number integer NOT NULL,
    people_count integer NOT NULL,
    waiter_id varchar NOT NULL REFERENCES users(id),
    status text NOT NULL DEFAULT 'aberta',
    payment_method text,
    subtotal decimal(10, 2),
    service_fee_percent decimal(5, 2) NOT NULL DEFAULT '10.00',
    service_fee_amount decimal(10, 2),
    total decimal(10, 2),
    notes text,
    opened_at timestamp NOT NULL DEFAULT now(),
    closed_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS restaurant_order_items (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id varchar NOT NULL REFERENCES restaurant_orders(id),
    menu_item_id varchar REFERENCES restaurant_menu_items(id),
    name text NOT NULL,
    unit_price decimal(10, 2) NOT NULL,
    quantity integer NOT NULL DEFAULT 1,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS restaurant_orders_status_idx
  ON restaurant_orders (status)
`;

await sql`
  CREATE INDEX IF NOT EXISTS restaurant_order_items_order_idx
  ON restaurant_order_items (order_id)
`;

console.log(
  "[migration] Tabelas restaurant_menu_items, restaurant_orders e restaurant_order_items criadas (ou já existentes).",
);
