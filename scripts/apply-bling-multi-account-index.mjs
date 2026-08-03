/**
 * Prepara o banco para as consultas de vendedores vinculados a múltiplas
 * contas Bling.
 *
 * A estrutura de vínculo (`bling_seller_mappings`) já existe. Esta migração
 * adiciona o índice composto usado para relacionar cada pedido ao vínculo por
 * `(connection_id, seller_id)` sem bloquear as escritas da tabela durante a
 * criação do índice.
 *
 * Idempotente: pode ser executado mais de uma vez.
 *
 * Uso:
 *   npm run db:apply-bling-multi-account
 *   npm run db:apply-bling-multi-account -- --check
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const INDEX_NAME = "bling_orders_connection_seller_idx";
const isCheckOnly = process.argv.includes("--check");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[migration] Defina DATABASE_URL no ambiente ou no arquivo .env.");
  process.exit(1);
}

const sql = neon(databaseUrl);

const requiredObjects = await sql`
  SELECT
    to_regclass('public.bling_orders') IS NOT NULL AS has_orders_table,
    to_regclass('public.bling_seller_mappings') IS NOT NULL AS has_mappings_table,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'bling_orders'
        AND column_name = 'connection_id'
    ) AS has_connection_id,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'bling_orders'
        AND column_name = 'seller_id'
    ) AS has_seller_id
`;

const prerequisites = requiredObjects[0];
const missing = [];

if (!prerequisites.has_orders_table) missing.push("tabela bling_orders");
if (!prerequisites.has_mappings_table) {
  missing.push("tabela bling_seller_mappings");
}
if (!prerequisites.has_connection_id) {
  missing.push("coluna bling_orders.connection_id");
}
if (!prerequisites.has_seller_id) {
  missing.push("coluna bling_orders.seller_id");
}

if (missing.length > 0) {
  console.error(
    `[migration] Pré-requisitos ausentes: ${missing.join(", ")}. ` +
      "Aplique primeiro o schema base do projeto.",
  );
  process.exit(1);
}

async function readIndexStatus() {
  const rows = await sql`
    SELECT
      index_class.relname AS index_name,
      index_info.indisvalid AS is_valid,
      pg_get_indexdef(index_info.indexrelid) AS definition
    FROM pg_index index_info
    JOIN pg_class index_class ON index_class.oid = index_info.indexrelid
    JOIN pg_class table_class ON table_class.oid = index_info.indrelid
    JOIN pg_namespace table_namespace ON table_namespace.oid = table_class.relnamespace
    WHERE table_namespace.nspname = 'public'
      AND table_class.relname = 'bling_orders'
      AND index_class.relname = ${INDEX_NAME}
  `;

  return rows[0] ?? null;
}

const currentStatus = await readIndexStatus();

if (isCheckOnly) {
  if (!currentStatus) {
    console.log(`[migration] Índice ${INDEX_NAME} ainda não foi criado.`);
    process.exit(0);
  }

  console.log(
    currentStatus.is_valid
      ? `[migration] Índice ${INDEX_NAME} existe e está válido.`
      : `[migration] Índice ${INDEX_NAME} existe, mas está inválido.`,
  );
  console.log(`  ${currentStatus.definition}`);
  process.exit(currentStatus.is_valid ? 0 : 1);
}

if (currentStatus?.is_valid) {
  console.log(`[migration] Índice ${INDEX_NAME} já existe e está válido.`);
  process.exit(0);
}

if (currentStatus && !currentStatus.is_valid) {
  console.log(`[migration] Removendo índice inválido ${INDEX_NAME}...`);
  await sql`DROP INDEX CONCURRENTLY IF EXISTS bling_orders_connection_seller_idx`;
}

console.log(`[migration] Criando índice ${INDEX_NAME}...`);
await sql`
  CREATE INDEX CONCURRENTLY IF NOT EXISTS bling_orders_connection_seller_idx
  ON bling_orders (connection_id, seller_id)
`;

const appliedStatus = await readIndexStatus();
if (!appliedStatus?.is_valid) {
  console.error(`[migration] O índice ${INDEX_NAME} não ficou válido.`);
  process.exit(1);
}

console.log(`[migration] Índice ${INDEX_NAME} criado e validado com sucesso.`);

