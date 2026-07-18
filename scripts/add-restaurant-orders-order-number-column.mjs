/**
 * Adiciona um identificador incremental (order_number) às comandas do PDV
 * Restaurante, exibido na lista de comandas para referência rápida do
 * vendedor (ex: "#42"), como alternativa amigável ao UUID interno.
 *
 * Uso:
 *   node scripts/add-restaurant-orders-order-number-column.mjs
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
  CREATE SEQUENCE IF NOT EXISTS restaurant_orders_order_number_seq
`;

await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS order_number integer
`;

// Backfill comandas existentes em ordem cronológica de abertura.
await sql`
  WITH numbered AS (
    SELECT id, row_number() OVER (ORDER BY opened_at, created_at) AS rn
    FROM restaurant_orders
    WHERE order_number IS NULL
  )
  UPDATE restaurant_orders o
  SET order_number = numbered.rn
  FROM numbered
  WHERE o.id = numbered.id
`;

// Sincroniza a sequence para continuar depois do maior número já usado.
await sql`
  SELECT setval(
    'restaurant_orders_order_number_seq',
    COALESCE((SELECT MAX(order_number) FROM restaurant_orders), 0) + 1,
    false
  )
`;

await sql`
  ALTER TABLE restaurant_orders
    ALTER COLUMN order_number SET DEFAULT nextval('restaurant_orders_order_number_seq')
`;

await sql`
  ALTER TABLE restaurant_orders ALTER COLUMN order_number SET NOT NULL
`;

await sql`
  ALTER SEQUENCE restaurant_orders_order_number_seq OWNED BY restaurant_orders.order_number
`;

await sql`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'restaurant_orders_order_number_unique'
    ) THEN
      ALTER TABLE restaurant_orders
        ADD CONSTRAINT restaurant_orders_order_number_unique UNIQUE (order_number);
    END IF;
  END $$
`;

console.log(
  "[migration] Coluna order_number adicionada e preenchida em restaurant_orders (ou já existente).",
);
