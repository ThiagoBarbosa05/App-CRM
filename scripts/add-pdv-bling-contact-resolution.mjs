/**
 * Campos e índices do fluxo híbrido de contatos do PDV Restaurante.
 * Idempotente: pode ser executado mais de uma vez.
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Defina DATABASE_URL no .env");
const sql = neon(url);

await sql`ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_contact_id_used text`;
await sql`ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_contact_resolution text`;
await sql`ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_contact_fallback_authorized_by varchar REFERENCES users(id)`;
await sql`ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_contact_fallback_authorized_at timestamp`;
await sql`ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_contact_fallback_reason text`;

await sql`ALTER TABLE restaurant_orders DROP CONSTRAINT IF EXISTS restaurant_orders_bling_contact_resolution_check`;
await sql`
  ALTER TABLE restaurant_orders
  ADD CONSTRAINT restaurant_orders_bling_contact_resolution_check
  CHECK (bling_contact_resolution IS NULL OR bling_contact_resolution IN ('cliente_crm','consumidor_final'))
`;

const duplicates = await sql`
  SELECT connection_id, client_id, COUNT(*)::integer AS count
  FROM bling_contact_mappings
  GROUP BY connection_id, client_id
  HAVING COUNT(*) > 1
`;
if (duplicates.length > 0) {
  throw new Error(
    `Existem ${duplicates.length} pares (conexão, cliente) duplicados em bling_contact_mappings. Corrija-os antes de criar o índice.`,
  );
}

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS bling_contact_mappings_conn_client_uidx
  ON bling_contact_mappings(connection_id, client_id)
`;

console.log("[migration] Resolução de contatos do PDV pronta.");
