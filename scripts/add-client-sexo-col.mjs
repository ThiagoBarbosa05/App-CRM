/**
 * Adiciona a coluna `sexo` à tabela `clients`.
 * A coluna já existe no schema Drizzle (shared/schema.ts) como
 * text("sexo", { enum: ["M", "F"] }), mas nunca foi aplicada ao banco,
 * causando o erro `column "sexo" does not exist` ao listar clientes.
 *
 * Uso (banco de produção):
 *   node scripts/add-client-sexo-col.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-client-sexo-col.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL ou TEST_DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS sexo text
`;

console.log("[migration] Coluna sexo adicionada à tabela clients.");
